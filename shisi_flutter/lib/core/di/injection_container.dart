import 'package:get_it/get_it.dart';
import 'package:shisi_flutter/core/network/dio_client.dart';
import 'package:shisi_flutter/core/storage/secure_storage.dart';
import 'package:shisi_flutter/data/repositories/auth_repository_impl.dart';
import 'package:shisi_flutter/data/repositories/message_repository_impl.dart';
import 'package:shisi_flutter/data/repositories/note_repository_impl.dart';
import 'package:shisi_flutter/domain/repositories/auth_repository.dart';
import 'package:shisi_flutter/domain/repositories/message_repository.dart';
import 'package:shisi_flutter/domain/repositories/note_repository.dart';
import 'package:shisi_flutter/domain/usecases/get_notes_usecase.dart';
import 'package:shisi_flutter/domain/usecases/login_usecase.dart';
import 'package:shisi_flutter/domain/usecases/send_message_usecase.dart';
import 'package:shisi_flutter/presentation/blocs/auth/auth_bloc.dart';
import 'package:shisi_flutter/presentation/blocs/chat/chat_bloc.dart';
import 'package:shisi_flutter/presentation/blocs/note/note_bloc.dart';
import 'package:shisi_flutter/core/router/app_router.dart';

final sl = GetIt.instance;

Future<void> init() async {
  // Blocs
  sl.registerLazySingleton(
    () => AuthBloc(
      authRepository: sl(),
      loginUseCase: sl(),
    ),
  );
  sl.registerLazySingleton(
    () => NoteBloc(
      getNotesUseCase: sl(),
    ),
  );
  sl.registerLazySingleton(
    () => ChatBloc(
      sendMessageUseCase: sl(),
    ),
  );

  // Use cases
  sl.registerLazySingleton(() => LoginUseCase(sl()));
  sl.registerLazySingleton(() => GetNotesUseCase(sl()));
  sl.registerLazySingleton(() => SendMessageUseCase(sl()));

  // Repositories
  sl.registerLazySingleton<NoteRepository>(
    () => NoteRepositoryImpl(
      dioClient: sl(),
    ),
  );
  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(
      dioClient: sl(),
      secureStorage: sl(),
    ),
  );
  sl.registerLazySingleton<MessageRepository>(
    () => MessageRepositoryImpl(
      dioClient: sl(),
    ),
  );

  // Core
  sl.registerLazySingleton(() => DioClient(
        baseUrl: 'http://120.26.35.225:3000/api', 
        secureStorage: sl(),
      ));
  sl.registerLazySingleton(() => SecureStorage());
  
  // Router
  sl.registerLazySingleton(() => AppRouter(sl()));
}
