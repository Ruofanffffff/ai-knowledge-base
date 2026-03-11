import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shisi_flutter/domain/entities/note.dart';
import 'package:shisi_flutter/domain/usecases/get_notes_usecase.dart';

part 'note_event.dart';
part 'note_state.dart';

class NoteBloc extends Bloc<NoteEvent, NoteState> {
  final GetNotesUseCase getNotesUseCase;

  NoteBloc({required this.getNotesUseCase}) : super(NoteInitial()) {
    on<LoadNotes>(_onLoadNotes);
  }

  Future<void> _onLoadNotes(LoadNotes event, Emitter<NoteState> emit) async {
    emit(NoteLoading());
    try {
      final notes = await getNotesUseCase();
      emit(NoteLoaded(notes));
    } catch (e) {
      emit(NoteError(e.toString()));
    }
  }
}
