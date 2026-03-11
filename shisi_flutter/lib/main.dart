import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shisi_flutter/core/di/injection_container.dart' as di;
import 'package:shisi_flutter/core/router/app_router.dart';
import 'package:shisi_flutter/presentation/blocs/auth/auth_bloc.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize dependency injection
  await di.init();

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Get the router from DI
    final appRouter = di.sl<AppRouter>();

    return MultiBlocProvider(
      providers: [
        BlocProvider<AuthBloc>(
          create: (_) => di.sl<AuthBloc>()..add(AuthCheckRequested()),
        ),
      ],
      child: MaterialApp.router(
        title: 'Hi Brain',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
          useMaterial3: true,
        ),
        routerConfig: appRouter.router,
      ),
    );
  }
}
