import 'package:shisi_flutter/core/network/dio_client.dart';
import 'package:shisi_flutter/domain/entities/note.dart';
import 'package:shisi_flutter/domain/repositories/note_repository.dart';

class NoteRepositoryImpl implements NoteRepository {
  final DioClient dioClient;

  NoteRepositoryImpl({required this.dioClient});

  @override
  Future<List<Note>> getNotes() async {
    try {
      // 模拟延迟
      await Future.delayed(const Duration(milliseconds: 500));
      
      // 暂时返回模拟数据，因为没有实际的后端接口
      return [
        Note(
          id: '1',
          title: '欢迎使用 Shisi 笔记',
          content: '这是一个简单的笔记应用，用于记录你的想法。',
          createdAt: DateTime.now().subtract(const Duration(days: 1)),
          updatedAt: DateTime.now(),
          authorId: 'user1',
        ),
        Note(
          id: '2',
          title: '今天的待办事项',
          content: '1. 完成 NoteBloc 实现\n2. 完成 NoteListPage 页面\n3. 测试功能',
          createdAt: DateTime.now(),
          updatedAt: null,
          authorId: 'user1',
        ),
      ];

      /* 实际接口调用代码
      final response = await dioClient.get('/notes');
      final List<dynamic> data = response.data;
      return data.map((json) => Note.fromJson(json)).toList();
      */
    } catch (e) {
      throw Exception('Failed to fetch notes: $e');
    }
  }

  @override
  Future<Note?> getNoteById(String id) async {
    try {
      final response = await dioClient.get('/notes/$id');
      return Note.fromJson(response.data);
    } catch (e) {
      return null;
    }
  }

  @override
  Future<void> createNote(Note note) async {
    try {
      await dioClient.post('/notes', data: note.toJson());
    } catch (e) {
      throw Exception('Failed to create note: $e');
    }
  }

  @override
  Future<void> updateNote(Note note) async {
    try {
      await dioClient.put('/notes/${note.id}', data: note.toJson());
    } catch (e) {
      throw Exception('Failed to update note: $e');
    }
  }

  @override
  Future<void> deleteNote(String id) async {
    try {
      await dioClient.delete('/notes/$id');
    } catch (e) {
      throw Exception('Failed to delete note: $e');
    }
  }
}
