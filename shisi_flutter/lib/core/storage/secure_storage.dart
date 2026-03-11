import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  final _storage = const FlutterSecureStorage();

  // 写入数据
  Future<void> write(String key, String value) async {
    await _storage.write(key: key, value: value);
  }

  // 读取数据
  Future<String?> read(String key) async {
    return await _storage.read(key: key);
  }

  // 删除数据
  Future<void> delete(String key) async {
    await _storage.delete(key: key);
  }

  // 删除所有数据
  Future<void> deleteAll() async {
    await _storage.deleteAll();
  }

  // 检查键是否存在
  Future<bool> containsKey(String key) async {
    return await _storage.containsKey(key: key);
  }
}
