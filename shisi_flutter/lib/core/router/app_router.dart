import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shisi_flutter/presentation/blocs/auth/auth_bloc.dart';
import 'package:shisi_flutter/presentation/pages/auth/login_page.dart';
import 'package:shisi_flutter/presentation/pages/main_screen.dart';
import 'package:shisi_flutter/presentation/pages/note/note_list_page.dart';
import 'package:shisi_flutter/presentation/pages/hibrain/hibrain_page.dart';
import 'package:shisi_flutter/presentation/pages/profile/profile_page.dart';

class AppRouter {
  final AuthBloc authBloc;

  AppRouter(this.authBloc);

  late final GoRouter router = GoRouter(
    initialLocation: '/login',
    refreshListenable: GoRouterRefreshStream(authBloc.stream),
    redirect: (context, state) {
      final authState = authBloc.state;
      final isLoggingIn = state.uri.toString() == '/login';
      final isRegistering = state.uri.toString() == '/register';

      if (authState is AuthUnauthenticated && !isLoggingIn && !isRegistering) {
        return '/login';
      }

      if (authState is AuthAuthenticated && (isLoggingIn || isRegistering)) {
        return '/home';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginPage(),
      ),
      ShellRoute(
        builder: (context, state, child) => MainScreen(child: child),
        routes: [
          GoRoute(
            path: '/home',
            builder: (context, state) => const NoteListPage(),
          ),
          GoRoute(
            path: '/hibrain',
            builder: (context, state) => const HiBrainPage(),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => const ProfilePage(),
          ),
        ],
      ),
    ],
  );
}

class GoRouterRefreshStream extends ChangeNotifier {
  GoRouterRefreshStream(Stream<dynamic> stream) {
    notifyListeners();
    _subscription = stream.asBroadcastStream().listen(
      (dynamic _) => notifyListeners(),
    );
  }

  late final StreamSubscription<dynamic> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
