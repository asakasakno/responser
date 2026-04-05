import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Shield, Users, AlertTriangle } from "lucide-react";
import { Navigate } from "react-router-dom";

interface AdminUser {
  user_id: string;
  email: string;
  name: string | null;
  created_at: string;
  suspended: boolean;
  plan: string;
  payment_enabled: boolean;
  subscription_id: string | null;
  platforms: string[];
}

export default function Admin() {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const checkAdmin = async () => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user!.id)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!data);
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase.functions.invoke("admin", {
      body: { action: "list_users" },
    });
    if (error) {
      toast({ title: "오류", description: "사용자 목록을 불러올 수 없습니다.", variant: "destructive" });
    } else {
      setUsers(data.users || []);
    }
    setLoadingUsers(false);
  };

  const adminAction = async (action: string, params: Record<string, any>) => {
    const key = `${action}-${params.user_id}`;
    setActionLoading(key);
    const { error } = await supabase.functions.invoke("admin", {
      body: { action, ...params },
    });
    if (error) {
      toast({ title: "오류", description: "작업에 실패했습니다.", variant: "destructive" });
    } else {
      toast({ title: "완료", description: "성공적으로 변경되었습니다." });
      fetchUsers();
    }
    setActionLoading(null);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">로딩 중...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isAdmin === null) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">권한 확인 중...</div>;
  if (!isAdmin) return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">접근 권한이 없습니다</h1>
        <p className="text-muted-foreground">관리자만 접근할 수 있는 페이지입니다.</p>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">관리자 대시보드</h1>
            <p className="text-muted-foreground">사용자 관리 및 시스템 설정</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">전체 사용자</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{users.length}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">유료 사용자</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{users.filter(u => u.plan !== "free").length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">정지된 사용자</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-destructive">{users.filter(u => u.suspended).length}</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>사용자 관리</CardTitle>
            <CardDescription>유저 플랜 변경, 결제 ON/OFF, 사용 정지를 관리합니다.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <p className="text-muted-foreground py-8 text-center">로딩 중...</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이메일</TableHead>
                      <TableHead>이름</TableHead>
                      <TableHead>플랜</TableHead>
                      <TableHead>결제</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>가입일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.user_id} className={u.suspended ? "opacity-60" : ""}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell>{u.name || "-"}</TableCell>
                        <TableCell>
                          <Select
                            value={u.plan}
                            onValueChange={(plan) => adminAction("change_plan", { user_id: u.user_id, plan })}
                            disabled={actionLoading === `change_plan-${u.user_id}`}
                          >
                            <SelectTrigger className="w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="basic">Basic</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={u.payment_enabled}
                            onCheckedChange={(checked) =>
                              adminAction("toggle_payment", { user_id: u.user_id, payment_enabled: checked })
                            }
                            disabled={actionLoading === `toggle_payment-${u.user_id}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant={u.suspended ? "default" : "destructive"}
                            size="sm"
                            onClick={() => adminAction("toggle_suspend", { user_id: u.user_id, suspended: !u.suspended })}
                            disabled={actionLoading === `toggle_suspend-${u.user_id}`}
                          >
                            {u.suspended ? "정지 해제" : "사용 정지"}
                          </Button>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(u.created_at).toLocaleDateString("ko-KR")}
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          등록된 사용자가 없습니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
