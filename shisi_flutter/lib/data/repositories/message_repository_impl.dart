import 'package:shisi_flutter/core/network/dio_client.dart';
import 'package:shisi_flutter/domain/entities/message.dart';
import 'package:shisi_flutter/domain/repositories/message_repository.dart';

class MessageRepositoryImpl implements MessageRepository {
  final DioClient dioClient;

  MessageRepositoryImpl({required this.dioClient});

  @override
  Future<void> sendMessage(Message message) async {
    try {
      await dioClient.post(
        '/messages',
        data: message.toJson(),
      );
    } catch (e) {
      throw Exception('Failed to send message: $e');
    }
  }

  @override
  Future<List<Message>> getMessages(String userId) async {
    try {
      final response = await dioClient.get('/messages/$userId');
      if (response.statusCode == 200) {
        final List<dynamic> data = response.data;
        return data.map((json) => Message.fromJson(json)).toList();
      } else {
        throw Exception('Failed to load messages');
      }
    } catch (e) {
      throw Exception('Failed to load messages: $e');
    }
  }
}
