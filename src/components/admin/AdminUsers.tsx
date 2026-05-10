import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAdminAction } from '@/hooks/useAdminAction';
import { toast } from '@/hooks/use-toast';
import { Search, Zap, Minus, Plus, LogOut, Trash2 } from 'lucide-react';

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

type BulkActionKind = 'force_logout' | 'suspend' | 'unsuspend' | 'delete_user' | 'change_plan';

export default function AdminUsers() {
  const { invoke, loading } = useAdminAction();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPlan, setBulkPlan] = useState<string>('');

  // Energy dialog (single)
  const [energyDialog, setEnergyDialog] = useState<{ user: AdminUser; type: 'earn' | 'spend' } | null>(null);
  const [energyAmount, setEnergyAmount] = useState('');
  const [energyReason, setEnergyReason] = useState('');

  // Reason dialog — supports both single (params.user_id) and bulk (userIds[])
  const [reasonDialog, setReasonDialog] = useState<null | {
    title: string;
    action: string;
    params: Record<string, any>;
    userIds?: string[];          // when set → bulk loop
    requireReason?: boolean;     // bulk actions without reason (e.g. force_logout) skip reason check
  }>(null);
  const [reasonText, setReasonText] = useState('');
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const data = await invoke('list_users');
    if (data) setUsers(data.users || []);
    setLoadingUsers(false);
    setSelected(new Set());
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

  // Run a per-user action across many users sequentially.
  const runBulk = async (
    userIds: string[],
    buildBody: (uid: string) => { action: string; params: Record<string, any> },
    meta: { bulk_action: string; reason?: string | null },
  ) => {
    const bulk_id = (crypto as any).randomUUID ? (crypto as any).randomUUID() : `bulk_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setBulkProgress({ done: 0, total: userIds.length });

    // start summary log
    await invoke('bulk_audit', {
      phase: 'start',
      bulk_id,
      bulk_action: meta.bulk_action,
      target_user_ids: userIds,
      reason: meta.reason ?? null,
      total: userIds.length,
    }, `bulk_audit_start_${bulk_id}`);

    let ok = 0; let fail = 0;
    for (let i = 0; i < userIds.length; i++) {
      const { action, params } = buildBody(userIds[i]);
      const res = await invoke(
        action,
        { ...params, bulk_id, bulk_index: i, bulk_total: userIds.length },
        `bulk-${action}-${userIds[i]}`,
      );
      if (res?.success) ok++; else fail++;
      setBulkProgress({ done: i + 1, total: userIds.length });
    }

    // complete summary log
    await invoke('bulk_audit', {
      phase: 'complete',
      bulk_id,
      bulk_action: meta.bulk_action,
      target_user_ids: userIds,
      reason: meta.reason ?? null,
      success_count: ok,
      fail_count: fail,
      total: userIds.length,
    }, `bulk_audit_complete_${bulk_id}`);

    setBulkProgress(null);
    toast({
      title: '일괄 작업 완료',
      description: `성공 ${ok}건, 실패 ${fail}건 (총 ${userIds.length}건)`,
      variant: fail > 0 ? 'destructive' : 'default',
    });
    fetchUsers();
  };

  const submitReason = async () => {
    if (!reasonDialog) return;
    const needReason = reasonDialog.requireReason !== false;
    if (needReason && reasonText.trim().length < 5) return;

    if (reasonDialog.userIds && reasonDialog.userIds.length > 0) {
      const ids = reasonDialog.userIds;
      const baseParams = { ...reasonDialog.params };
      if (needReason) baseParams.reason = reasonText;
      const action = reasonDialog.action;
      setReasonDialog(null);
      setReasonText('');
      await runBulk(
        ids,
        (uid) => ({ action, params: { ...baseParams, user_id: uid } }),
        { bulk_action: action, reason: needReason ? reasonText : null },
      );
    } else {
      await adminAction(reasonDialog.action, { ...reasonDialog.params, ...(needReason ? { reason: reasonText } : {}) });
      setReasonDialog(null);
      setReasonText('');
    }
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

  const filteredIds = useMemo(() => filtered.map(u => u.user_id), [filtered]);
  const allChecked = filteredIds.length > 0 && filteredIds.every(id => selected.has(id));
  const someChecked = filteredIds.some(id => selected.has(id)) && !allChecked;

  const toggleAll = () => {
    if (allChecked) {
      const next = new Set(selected);
      filteredIds.forEach(id => next.delete(id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filteredIds.forEach(id => next.add(id));
      setSelected(next);
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const selectedUsers = useMemo(
    () => users.filter(u => selected.has(u.user_id)),
    [users, selected],
  );

  const openBulk = (kind: BulkActionKind, plan?: string) => {
    if (selectedIds.length === 0) {
      toast({ title: '선택된 사용자가 없습니다.', variant: 'destructive' });
      return;
    }
    if (kind === 'force_logout') {
      setReasonDialog({
        title: `일괄 강제 로그아웃 — ${selectedIds.length}명`,
        action: 'force_logout',
        params: {},
        userIds: selectedIds,
        requireReason: false,
      });
      return;
    }
    if (kind === 'suspend' || kind === 'unsuspend') {
      const suspended = kind === 'suspend';
      setReasonDialog({
        title: `일괄 ${suspended ? '계정 정지' : '정지 해제'} — ${selectedIds.length}명`,
        action: 'toggle_suspend',
        params: { suspended },
        userIds: selectedIds,
      });
      return;
    }
    if (kind === 'delete_user') {
      setReasonDialog({
        title: `일괄 계정 영구 삭제 — ${selectedIds.length}명 (관리자 계정 자동 제외)`,
        action: 'delete_user',
        params: {},
        userIds: selectedIds,
      });
      return;
    }
    if (kind === 'change_plan' && plan) {
      setReasonDialog({
        title: `일괄 플랜 변경 → ${plan} — ${selectedIds.length}명`,
        action: 'change_plan',
        params: { plan },
        userIds: selectedIds,
      });
    }
  };

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

          {/* Bulk actions toolbar */}
          {selectedIds.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2">
              <span className="text-sm font-medium px-1">{selectedIds.length}명 선택됨</span>
              <Button size="sm" variant="outline" onClick={() => openBulk('force_logout')}>
                <LogOut className="w-3.5 h-3.5 mr-1" /> 강제 로그아웃
              </Button>
              <Button size="sm" variant="destructive" onClick={() => openBulk('suspend')}>일괄 정지</Button>
              <Button size="sm" variant="outline" onClick={() => openBulk('unsuspend')}>정지 해제</Button>
              <div className="flex items-center gap-1">
                <Select value={bulkPlan} onValueChange={(v) => { setBulkPlan(v); openBulk('change_plan', v); setBulkPlan(''); }}>
                  <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="플랜 변경..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free 로 변경</SelectItem>
                    <SelectItem value="basic">Basic 로 변경</SelectItem>
                    <SelectItem value="pro">Pro 로 변경</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="destructive" className="ml-auto" onClick={() => openBulk('delete_user')}>
                <Trash2 className="w-3.5 h-3.5 mr-1" /> 일괄 삭제
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>선택 해제</Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <p className="text-center text-muted-foreground py-8">로딩 중...</p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                        onCheckedChange={toggleAll}
                        aria-label="전체 선택"
                      />
                    </TableHead>
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
                    <TableRow key={u.user_id} className={u.suspended ? 'opacity-50' : ''} data-state={selected.has(u.user_id) ? 'selected' : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(u.user_id)}
                          onCheckedChange={() => toggleOne(u.user_id)}
                          aria-label={`${u.email} 선택`}
                        />
                      </TableCell>
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
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-destructive/10" title="계정 삭제"
                            onClick={() => setReasonDialog({
                              title: `계정 영구 삭제 — ${u.email}`,
                              action: 'delete_user',
                              params: { user_id: u.user_id },
                            })}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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

      {/* Reason Dialog (single + bulk) */}
      <Dialog open={!!reasonDialog} onOpenChange={() => { if (!bulkProgress) { setReasonDialog(null); setReasonText(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{reasonDialog?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {reasonDialog?.requireReason !== false && (
              <Input placeholder="사유 (5자 이상, 필수)" value={reasonText}
                onChange={e => setReasonText(e.target.value)} />
            )}
            {reasonDialog?.userIds && reasonDialog.userIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                대상 {reasonDialog.userIds.length}명에 대해 순차적으로 실행됩니다. 관리자 계정 등 일부는 서버에서 자동 차단될 수 있습니다.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReasonDialog(null); setReasonText(''); }}>취소</Button>
            <Button onClick={submitReason}
              disabled={reasonDialog?.requireReason !== false && reasonText.trim().length < 5}>
              적용
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk progress */}
      <Dialog open={!!bulkProgress}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>일괄 작업 진행 중...</DialogTitle></DialogHeader>
          <div className="py-4 text-center text-sm">
            {bulkProgress?.done} / {bulkProgress?.total} 처리됨
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
