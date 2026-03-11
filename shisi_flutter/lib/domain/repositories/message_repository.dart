import '../entities/message.dart';

abstract class MessageRepository {
  Future<void> sendMessage(Message message);
  Future<List<Message>> getMessages(String userId);
}
