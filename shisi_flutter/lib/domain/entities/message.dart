class Message {
  final String id;
  final String content;
  final String senderId;
  final String receiverId;
  final DateTime createdAt;

  Message({
    required this.id,
    required this.content,
    required this.senderId,
    required this.receiverId,
    required this.createdAt,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'],
      content: json['content'],
      senderId: json['senderId'],
      receiverId: json['receiverId'],
      createdAt: DateTime.parse(json['createdAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'content': content,
      'senderId': senderId,
      'receiverId': receiverId,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}
