import '../entities/message.dart';
import '../repositories/message_repository.dart';

class SendMessageUseCase {
  final MessageRepository repository;

  SendMessageUseCase(this.repository);

  Future<void> call(Message message) {
    return repository.sendMessage(message);
  }
}
