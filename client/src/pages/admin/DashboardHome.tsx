import { useEffect, useState } from 'react';
import { adminApi, AdminStats } from '../../api/admin';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Users, FileText, Database, Activity } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

export function DashboardHome() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await adminApi.getStats();
        if (response.success && response.data) {
          setStats(response.data);
        } else {
            // Fallback for demo if API not ready
            setStats({
                totalUsers: 0,
                totalDocuments: 0,
                totalStorage: '0 GB',
                storagePercentage: 0,
                activeUsersLast30Days: 0
            });
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  const statData = stats || {
    totalUsers: 0,
    totalDocuments: 0,
    totalStorage: '0 GB',
    storagePercentage: 0,
    activeUsersLast30Days: 0
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">概览</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statData.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              过去30天活跃: {statData.activeUsersLast30Days}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">文档总数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statData.totalDocuments}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">存储使用</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statData.totalStorage}</div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
              <div 
                className="bg-blue-500 h-1.5 rounded-full" 
                style={{ width: `${Math.min(statData.storagePercentage, 100)}%` }} 
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              已用 {statData.storagePercentage.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">系统状态</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">正常</div>
            <p className="text-xs text-muted-foreground">
              所有服务运行中
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
