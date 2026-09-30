import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListUsers, useUpdateUserBalance, getListUsersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Users() {
  const { data: users, isLoading } = useListUsers({ query: { queryKey: getListUsersQueryKey() } });
  const updateUserBalance = useUpdateUserBalance();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBalance, setEditBalance] = useState<string>("");

  const startEditing = (id: number, currentBalance: number) => {
    setEditingId(id);
    setEditBalance(currentBalance.toString());
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditBalance("");
  };

  const saveEditing = async (id: number) => {
    const numBalance = parseFloat(editBalance);
    if (isNaN(numBalance)) {
      toast({ title: "Invalid number", variant: "destructive" });
      return;
    }

    try {
      await updateUserBalance.mutateAsync({
        id,
        data: { balance: numBalance }
      });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast({ title: "Balance updated" });
      setEditingId(null);
    } catch (e) {
      toast({ title: "Failed to update balance", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="space-y-2 p-6">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Users</h1>
      
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>Telegram ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Purchases</TableHead>
                <TableHead>Bonuses</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id} className="border-border">
                  <TableCell className="font-mono text-xs text-muted-foreground">{user.telegramId}</TableCell>
                  <TableCell className="font-medium">{user.username || user.firstName || "Unknown"}</TableCell>
                  <TableCell>{user.purchaseCount}</TableCell>
                  <TableCell>{user.bonuses}</TableCell>
                  <TableCell className="text-right">
                    {editingId === user.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <Input
                          type="number"
                          value={editBalance}
                          onChange={(e) => setEditBalance(e.target.value)}
                          className="w-24 h-8 text-right bg-background border-border"
                          step="0.01"
                        />
                      </div>
                    ) : (
                      formatCurrency(user.balance)
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === user.id ? (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-500/10" onClick={() => saveEditing(user.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={cancelEditing}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => startEditing(user.id, user.balance)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!users?.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-24">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
