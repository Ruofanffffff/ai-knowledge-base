import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shisi_flutter/core/di/injection_container.dart';
import 'package:shisi_flutter/presentation/blocs/chat/chat_bloc.dart';
import 'package:shisi_flutter/domain/entities/message.dart';

class HiBrainPage extends StatelessWidget {
  const HiBrainPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => sl<ChatBloc>(),
      child: const HiBrainView(),
    );
  }
}

class HiBrainView extends StatefulWidget {
  const HiBrainView({super.key});

  @override
  State<HiBrainView> createState() => _HiBrainViewState();
}

class _HiBrainViewState extends State<HiBrainView> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('HiBrain'),
      ),
      body: Column(
        children: [
          Expanded(
            child: BlocConsumer<ChatBloc, ChatState>(
              listener: (context, state) {
                if (state.status == ChatStatus.success || state.status == ChatStatus.loading) {
                   Future.delayed(const Duration(milliseconds: 100), _scrollToBottom);
                }
                if (state.status == ChatStatus.failure) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(state.errorMessage ?? '发送失败')),
                  );
                }
              },
              builder: (context, state) {
                if (state.messages.isEmpty) {
                  return const Center(child: Text('开始新的对话吧'));
                }
                return ListView.builder(
                  controller: _scrollController,
                  itemCount: state.messages.length,
                  padding: const EdgeInsets.all(16),
                  itemBuilder: (context, index) {
                    final message = state.messages[index];
                    final isMe = message.senderId == 'current_user';
                    return _MessageBubble(message: message, isMe: isMe);
                  },
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textController,
                    decoration: const InputDecoration(
                      hintText: '输入消息...',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.send),
                  onPressed: _sendMessage,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _sendMessage() {
    final content = _textController.text.trim();
    if (content.isNotEmpty) {
      context.read<ChatBloc>().add(SendMessage(content));
      _textController.clear();
    }
  }
}

class _MessageBubble extends StatelessWidget {
  final Message message;
  final bool isMe;

  const _MessageBubble({
    required this.message,
    required this.isMe,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isMe ? Colors.blue : Colors.grey[300],
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message.content,
              style: TextStyle(color: isMe ? Colors.white : Colors.black),
            ),
            const SizedBox(height: 4),
            Text(
              _formatTime(message.createdAt),
              style: TextStyle(
                fontSize: 10,
                color: isMe ? Colors.white70 : Colors.black54,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }
}
