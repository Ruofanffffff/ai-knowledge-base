import '../entities/user.dart';

abstract class AuthRepository {
  /// 登录
  Future<User> login(String username, String password);

  /// 注册
  Future<void> register(String username, String password);

  /// 登出
  Future<void> logout();

  /// 获取 Token
  Future<String?> getToken();

  /// 获取当前用户
  Future<User?> getCurrentUser();

  /// 检查是否已认证
  Future<bool> isAuthenticated();
}
