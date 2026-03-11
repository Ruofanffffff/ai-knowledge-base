import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color primary = Color(0xFF6366F1); // Indigo 500
  static const Color primaryLight = Color(0xFF8B5CF6); // Violet 500
  static const Color backgroundStart = Color(0xFFFDFDFF);
  static const Color backgroundEnd = Color(0xFFF3F8FF);
  static const Color cardBg = Color(0xCCFFFFFF);
  static const Color textPrimary = Color(0xFF1E1B4B);
  static const Color textSecondary = Color(0xFF6B7280);

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        background: backgroundStart,
      ),
      textTheme: GoogleFonts.notoSansTextTheme(),
      scaffoldBackgroundColor: backgroundStart,
    );
  }

  static BoxDecoration glassDecoration({double radius = 16}) {
    return BoxDecoration(
      color: cardBg,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: Colors.white.withOpacity(0.6)),
      boxShadow: [
        BoxShadow(
          color: primary.withOpacity(0.05),
          blurRadius: 16,
          offset: const Offset(0, 4),
        ),
      ],
    );
  }
}
