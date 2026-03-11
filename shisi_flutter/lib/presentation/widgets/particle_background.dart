import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class ParticleBackground extends StatelessWidget {
  final int count;
  const ParticleBackground({super.key, this.count = 30});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Gradient Base
        Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFFFDFDFF),
                Color(0xFFF8F5FF),
                Color(0xFFF3F8FF),
              ],
            ),
          ),
        ),
        // Particles
        ...List.generate(count, (index) {
          final rand = Random(index);
          final size = rand.nextDouble() * 4 + 2;
          final top = rand.nextDouble() * MediaQuery.of(context).size.height;
          final left = rand.nextDouble() * MediaQuery.of(context).size.width;
          final duration = 10 + rand.nextDouble() * 20;

          return Positioned(
            top: top,
            left: left,
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                color: const Color(0xFF6366F1).withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
            )
            .animate(onPlay: (c) => c.repeat(reverse: true))
            .moveY(begin: 0, end: -50, duration: duration.seconds)
            .fadeIn(duration: 2.seconds),
          );
        }),
      ],
    );
  }
}
