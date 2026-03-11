import 'package:bloc/bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:shisi_flutter/domain/entities/message.dart';
import 'package:shisi_flutter/domain/usecases/send_message_usecase.dart';

part 'chat_event.dart';
part 'chat_state.dart';

class ChatBloc extends Bloc<ChatEvent, ChatState> {
  final SendMessageUseCase sendMessageUseCase;

  ChatBloc({required this.sendMessageUseCase}) : super(const ChatState()) {
    on<SendMessage>(_onSendMessage);
  }

  Future<void> _onSendMessage(
    SendMessage event,
    Emitter<ChatState> emit,
  ) async {
    final tempMessage = Message(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      content: event.content,
      senderId: 'current_user', // TODO: Replace with actual user ID
      receiverId: 'bot', // Default receiver
      createdAt: DateTime.now(),
    );

    final updatedMessages = List<Message>.from(state.messages)..add(tempMessage);
    
    emit(state.copyWith(
      status: ChatStatus.loading,
      messages: updatedMessages,
    ));

    try {
      await sendMessageUseCase(tempMessage);
      emit(state.copyWith(status: ChatStatus.success));
    } catch (e) {
      emit(state.copyWith(
        status: ChatStatus.failure,
        errorMessage: e.toString(),
      ));
    }
  }
}
