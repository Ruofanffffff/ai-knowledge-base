import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shisi_flutter/presentation/widgets/bottom_nav.dart';

class MainScreen extends StatelessWidget {
  final Widget child;
  const MainScreen({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: Stack(
        children: [
          child,
          BottomNav(currentPath: GoRouterState.of(context).uri.path),
        ],
      ),
    );
  }
}
