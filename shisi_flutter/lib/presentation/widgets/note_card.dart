import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:shisi_flutter/domain/entities/note.dart';
import 'package:shisi_flutter/core/theme/app_theme.dart';

class NoteCard extends StatelessWidget {
  final Note note;
  final VoidCallback onTap;

  const NoteCard({
    super.key,
    required this.note,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: AppTheme.glassDecoration().copyWith(
          color: Colors.white.withValues(alpha: 0.88),
          border: Border.all(color: Colors.white.withValues(alpha: 0.95)),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Accent Bar
            Container(
              width: 24,
              height: 4,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(2),
                gradient: const LinearGradient(
                  colors: [Color(0xFF6366F1), Color(0x666366F1)],
                ),
              ),
            ),
            const SizedBox(height: 10),
            
            // Title
            if (note.title.isNotEmpty) ...[
              Text(
                note.title,
                style: GoogleFonts.notoSans(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.textPrimary,
                  height: 1.3,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
            ],

            // Content
            Text(
              note.content,
              style: GoogleFonts.notoSans(
                fontSize: 12,
                color: AppTheme.textSecondary,
                height: 1.6,
              ),
              maxLines: 4,
              overflow: TextOverflow.ellipsis,
            ),

            // Footer (Time)
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(LucideIcons.clock, size: 10, color: Color(0xFFC4C9D4)),
                const SizedBox(width: 4),
                Text(
                  _formatDate(note.createdAt),
                  style: GoogleFonts.notoSans(
                    fontSize: 10,
                    color: const Color(0xFFC4C9D4),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);
    if (diff.inMinutes < 60) return '刚刚';
    if (diff.inHours < 24) return '${diff.inHours}小时前';
    return '${date.month}月${date.day}日';
  }
}
