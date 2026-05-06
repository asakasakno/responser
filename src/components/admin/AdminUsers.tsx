import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAdminAction } from '@/hooks/useAdminAction';
import { toast } from '@/hooks/use-toast';
import { Search, Zap, Minus, Plus, LogOut } from 'lucide-react';

interface AdminUser {
  user_id: string;
  email: string;
  name: string | null;
  created_at: string;
  suspended: boolean;
  plan: string;
  payment_enabled: boolean;
  energy_balance: number;
  platforms: string[];
  today_usage: number;
  total_usage: number;
}

export default function AdminUsers() {
  const { invoke, loading } = useAdminAction();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Energy dialog
  const [energyDialog, setEnergyDialog] = useState<{ user: AdminUser; type: 'earn' | 'spend' } | null>(null);
  const [energyAmount, setEnergyAmount] = useState('');
  const [energyReason, setEnergyReason] = useState('');

  // Generic reason dialog (plan / suspend)
  const [reasonDialog, setReasonDialog] = useState<null | {
    title: string;
    action: string;
    params: Record<string, any>;
  }>(null);
  const [reasonText, setReasonText] = useState('');

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const data = await invoke('list_users');
    if (data) setUsers(data.users || []);
    setLoadingUsers(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const adminAction = async (action: string, params: Record<string, any>) => {
    const result = await invoke(action, params, `${action}-${params.user_id}`);
    if (result?.success) {
      toast({ title: '완료', description: '성공적으로 변경되었습니다.' });
      fetchUsers();
    }
  };

  const handleEnergySubmit = async () => {
    if (!energyDialog || !energyAmount || !energyReason) return;
    await adminAction('adjust_energy', {
      user_id: energyDialog.user.user_id,
      amount: parseInt(energyAmount),
      reason: energyReason,
      type: energyDialog.type,
    });
    setEnergyDialog(null);
    setEnergyAmount('');
    setEnergyReason('');
  };

  const submitReason = async () => {
    if (!reasonDialog || reasonText.trim().length < 5) return;
    await adminAction(reasonDialog.action, { ...reasonDialog.params, reason: reasonText });
    setReasonDialog(null);
    setReasonText('');
  };
  const filtered = users.filter(u => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || u.email.toLowerCase().includes(q) || (u.name && u.name.toLowerCase().includes(q));
    const matchPlan = planFilter === 'all' || u.plan === planFilter;
    const matchStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && !u.suspended) ||
      (statusFilter === 'suspended' && u.suspended);
    return matchSearch && matchPlan && matchStatus;
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">사용자 관리</h1>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="이름 또는 이메일 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2">
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-[100px]"><SelectValue placeholder="플랜" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[100px]"><SelectValue placeholder="상태" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="active">정상</SelectItem>
                  <SelectItem value="suspended">정지</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <p className="text-center text-muted-foreground py-8">로딩 중...</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이메일</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>플랜</TableHead>
                    <TableHead className="text-right">에너지</TableHead>
                    <TableHead className="text-center">사용량</TableHead>
                    <TableHead>결제</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => (
                    <TableRow key={u.user_id} className={u.suspended ? 'opacity-50' : ''}>
                      <TableCell className="font-medium text-xs">{u.email}</TableCell>
                      <TableCell className="text-sm">{u.name || '-'}</TableCell>
                      <TableCell>
                        <Select
                          value={u.plan}
                          onValueChange={plan => {
                            if (plan === u.plan) return;
                            setReasonDialog({
                              title: `플랜 변경 — ${u.email} (${u.plan} → ${plan})`,
                              action: 'change_plan',
                              params: { user_id: u.user_id, plan },
                            });
                          }}
                        >
                          <SelectTrigger className="w-[85px] h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Free</SelectItem>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Zap className="w-3 h-3 text-yellow-500" />
                          <span className="text-sm font-medium">{u.energy_balance}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {u.today_usage} / {u.total_usage}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.payment_enabled}
                          onCheckedChange={checked => adminAction('toggle_payment', { user_id: u.user_id, payment_enabled: checked })}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.suspended ? 'destructive' : 'secondary'} className="text-xs">
                          {u.suspended ? '정지' : '정상'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="에너지 지급"
                            onClick={() => setEnergyDialog({ user: u, type: 'earn' })}>
                            <Plus className="w-3.5 h-3.5 text-green-500" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="에너지 차감"
                            onClick={() => setEnergyDialog({ user: u, type: 'spend' })}>
                            <Minus className="w-3.5 h-3.5 text-red-500" />
                          </Button>
                          <Button size="sm" variant={u.suspended ? 'default' : 'destructive'} className="h-7 text-xs px-2"
                            onClick={() => setReasonDialog({
                              title: `${u.suspended ? '정지 해제' : '계정 정지'} — ${u.email}`,
                              action: 'toggle_suspend',
                              params: { user_id: u.user_id, suspended: !u.suspended },
                            })}>
                            {u.suspended ? '해제' : '정지'}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="강제 로그아웃"
                            onClick={() => adminAction('force_logout', { user_id: u.user_id })}>
                            <LogOut className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {searchQuery ? '검색 결과가 없습니다.' : '사용자가 없습니다.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Energy Dialog */}
      <Dialog open={!!energyDialog} onOpenChange={() => setEnergyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              에너지 {energyDialog?.type === 'earn' ? '지급' : '차감'} — {energyDialog?.user.email}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input type="number" placeholder="수량" value={energyAmount} onChange={e => setEnergyAmount(e.target.value)} min={1} />
            <Input placeholder="사유" value={energyReason} onChange={e => setEnergyReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnergyDialog(null)}>취소</Button>
            <Button onClick={handleEnergySubmit} disabled={!energyAmount || !energyReason}>
              {energyDialog?.type === 'earn' ? '지급' : '차감'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
