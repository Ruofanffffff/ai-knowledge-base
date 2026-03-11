import 'package:dio/dio.dart';
import 'package:shisi_flutter/core/network/dio_client.dart';
import 'package:shisi_flutter/core/storage/secure_storage.dart';
import 'package:shisi_flutter/domain/repositories/auth_repository.dart';
import 'package:shisi_flutter/domain/entities/user.dart';

class AuthRepositoryImpl implements AuthRepository {
  final DioClient _dioClient;
  final SecureStorage _secureStorage;
  static const String _tokenKey = 'auth_token';

  AuthRepositoryImpl({
    required DioClient dioClient,
    required SecureStorage secureStorage,
  })  : _dioClient = dioClient,
        _secureStorage = secureStorage;

  @override
  Future<User> login(String username, String password) async {
    try {
      final response = await _dioClient.post(
        '/auth/login',
        data: {
          'username': username,
          'password': password,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final token = response.data['token'];
        if (token != null) {
          await _secureStorage.write(_tokenKey, token);
        }
        
        if (response.data['user'] != null) {
          return User.fromJson(response.data['user']);
        } else {
           // Fallback if user object is not returned, create a temporary one
           // In a real app, you might want to fetch the user profile here
           return User(id: '0', username: username);
        }
      } else {
        throw Exception('Login failed: ${response.statusCode}');
      }
    } on DioException catch (e) {
      throw Exception('Network error during login: ${e.message}');
    } catch (e) {
      throw Exception('An error occurred during login: $e');
    }
  }

  @override
  Future<void> register(String username, String password) async {
    try {
      final response = await _dioClient.post(
        '/auth/register',
        data: {
          'username': username,
          'password': password,
        },
      );

      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception('Registration failed: ${response.statusCode}');
      }
    } on DioException catch (e) {
      throw Exception('Network error during registration: ${e.message}');
    } catch (e) {
      throw Exception('An error occurred during registration: $e');
    }
  }

  @override
  Future<void> logout() async {
    try {
      await _secureStorage.delete(_tokenKey);
    } catch (e) {
      throw Exception('Logout failed: $e');
    }
  }

  @override
  Future<String?> getToken() async {
    try {
      return await _secureStorage.read(_tokenKey);
    } catch (e) {
      throw Exception('Failed to get token: $e');
    }
  }

  @override
  Future<User?> getCurrentUser() async {
    try {
      final token = await getToken();
      if (token == null) return null;

      // Assuming /users/me or /auth/me endpoint exists
      final response = await _dioClient.get('/auth/me');
      
      if (response.statusCode == 200 && response.data != null) {
        return User.fromJson(response.data);
      }
      return null;
    } catch (e) {
      // If fetching user fails (e.g. invalid token), return null
      return null;
    }
  }

  @override
  Future<bool> isAuthenticated() async {
    try {
      final token = await _secureStorage.read(_tokenKey);
      return token != null && token.isNotEmpty;
    } catch (e) {
      return false;
    }
  }
}
