import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shisi_flutter/core/di/injection_container.dart';
import 'package:shisi_flutter/presentation/blocs/note/note_bloc.dart';

class NoteListPage extends StatelessWidget {
  const NoteListPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<NoteBloc>()..add(LoadNotes()),
      child: Scaffold(
        appBar: AppBar(
          title: const Text('我的笔记'),
          actions: [
            IconButton(
              icon: const Icon(Icons.add),
              onPressed: () {
                // TODO: Navigate to create note page
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('创建笔记功能开发中')),
                );
              },
            ),
          ],
        ),
        body: BlocBuilder<NoteBloc, NoteState>(
          builder: (context, state) {
            if (state is NoteLoading) {
              return const Center(child: CircularProgressIndicator());
            } else if (state is NoteLoaded) {
              if (state.notes.isEmpty) {
                return const Center(child: Text('暂无笔记'));
              }
              return ListView.builder(
                itemCount: state.notes.length,
                itemBuilder: (context, index) {
                  final note = state.notes[index];
                  return Card(
                    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: ListTile(
                      title: Text(
                        note.title,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text(
                        note.content,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: Text(
                        _formatDate(note.createdAt),
                        style: TextStyle(color: Colors.grey[600], fontSize: 12),
                      ),
                      onTap: () {
                        // TODO: Navigate to note detail page
                      },
                    ),
                  );
                },
              );
            } else if (state is NoteError) {
              return Center(child: Text('加载失败: ${state.message}'));
            }
            return const SizedBox.shrink();
          },
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }
}
