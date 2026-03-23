import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, MoreHorizontal, Heart, MessageCircle,
  Share2, Check, Bookmark, X, Send, ChevronDown
} from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { DirectMessageSheet } from '../components/DirectMessageSheet';
import { api } from '../services/api';

// ── Types ──────────────────────────────────────────────────────────────────────
interface GridPost {
  id: string; title: string; image: string;
  likes: number; tall: boolean; body: string; date: string; readTime: string;
}

// ── Mock profile data ─────────────────────────────────────────────────────────
const USER_PROFILES: Record<string, {
  name: string; username: string; avatarColor: string; avatarLetter: string;
  verified: boolean; bio: string; posts: number; following: number; followers: string;
  coverGradient: string; tags: string[];
}> = {
  '1': {
    name: '小明同学', username: 'xiaoming', avatarColor: '#6366F1', avatarLetter: '明', verified: true,
    bio: '设计师 × 思考者 ✨\n用 Hi Brain 把生活变成知识图谱\n每天分享设计灵感与思维方法 🧩',
    posts: 42, following: 318, followers: '1.2k',
    coverGradient: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #2563EB 100%)',
    tags: ['设计', '灵感', '知识管理'],
  },
  '2': {
    name: '阿博读书', username: 'abo_reads', avatarColor: '#8B5CF6', avatarLetter: '博', verified: false,
    bio: '每年读100本书 📚\n把书里的智慧装进思库\n分享有价值的知识碎片与深度思考',
    posts: 87, following: 204, followers: '3.4k',
    coverGradient: 'linear-gradient(135deg, #6D28D9 0%, #8B5CF6 50%, #C084FC 100%)',
    tags: ['读书', '心理学', '效率'],
  },
  '3': {
    name: 'TechNote', username: 'tech_note', avatarColor: '#3B82F6', avatarLetter: 'T', verified: true,
    bio: '前端工程师 × 知识管理极客 ⚛️\n用思链理清技术知识体系\n分享前沿技术洞见与工程实践',
    posts: 61, following: 512, followers: '8.9k',
    coverGradient: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 50%, #0EA5E9 100%)',
    tags: ['React', '技术', 'AI'],
  },
  '4': {
    name: '晓雯创作', username: 'xiaowen', avatarColor: '#EC4899', avatarLetter: '晓', verified: false,
    bio: '旅行者 × 写作者 ✈️\n用文字记录34个国家的瞬间\nAI 帮我发现了自己都不知道的思维模式',
    posts: 156, following: 431, followers: '12.7k',
    coverGradient: 'linear-gradient(135deg, #9D174D 0%, #EC4899 50%, #F97316 100%)',
    tags: ['旅行', 'AI', '灵感'],
  },
  '5': {
    name: '思维实验室', username: 'mind_lab', avatarColor: '#10B981', avatarLetter: '思', verified: true,
    bio: '认知科学爱好者 🧠\n研究如何在信息洪流中保持清醒\n知识图谱 = 对抗焦虑的最强武器',
    posts: 93, following: 267, followers: '21.3k',
    coverGradient: 'linear-gradient(135deg, #065F46 0%, #10B981 50%, #34D399 100%)',
    tags: ['知识管理', '方法论', '认知科学'],
  },
  '6': {
    name: '好奇心驱动', username: 'curious_one', avatarColor: '#F59E0B', avatarLetter: '奇', verified: false,
    bio: '笔记爱好者 × 学习研究者 📝\n混合笔记法实践者\n相信「好笔记 = 好思维」',
    posts: 74, following: 189, followers: '5.6k',
    coverGradient: 'linear-gradient(135deg, #92400E 0%, #F59E0B 50%, #FDE68A 100%)',
    tags: ['笔记方法', '学习', '效率'],
  },
};

// ── Mock grid posts ───────────────────────────────────────────────────────────
const GRID_POSTS: Record<string, GridPost[]> = {
  '1': [
    { id: 'p1', title: '设计系统原则：从原子到生态系统', image: 'https://images.unsplash.com/photo-1615387000571-bdcfe92eb67c?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=1000&q=80', likes: 128, tall: true, date: '2025-02-21', readTime: '4 分钟', body: '设计系统的核心是建立一套可复用的视觉语言。就像乐高积木，每一块组件都有明确的规则，组合起来却能构建无限可能。\n\n在过去3年的项目实践中，我总结出最关键的一点：**原子设计不是终点，而是起点**。从按钮到表单，从卡片到页面，每一层抽象都需要团队的共同理解和维护共识。\n\n用思链整理完这些笔记后，我发现「设计」和「系统工程」之间的连接比想象中深得多——它们都在追求同一件事：可预测的复杂性。' },
    { id: 'p2', title: '留白的力量：空间设计哲学', image: 'https://images.unsplash.com/photo-1769690398694-9c5d5ca4b4ea?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=640&q=80', likes: 94, tall: false, date: '2025-02-18', readTime: '3 分钟', body: '日本美学中有个词叫「间」（Ma），指的是空间与时间之间有意义的空白。这不是设计的缺失，而是设计的一部分。\n\n当我第一次看到原研哉的作品时，我意识到：最有力量的设计往往是最克制的。每一处留白都在引导眼睛，控制节奏，传递情绪。\n\n试着在你下一个设计稿里删掉30%的元素，你会发现剩下的70%变得更有力量。' },
    { id: 'p3', title: '色彩心理学与用户情绪', image: 'https://images.unsplash.com/photo-1654028122846-4910bf0db38c?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=680&q=80', likes: 211, tall: false, date: '2025-02-15', readTime: '5 分钟', body: '颜色不只是视觉信息，它是情绪的快捷键。蓝色降低心率、红色加速决策、绿色带来安全感——这些不是玄学，而是经过大量实验验证的神经科学结论。\n\n在 Hi Brain 的配色设计中，我选择了靛蓝+紫的渐变，原因正是：靛蓝传递智识与深度，紫色激发创造力与神秘感。两者叠加，恰好匹配「AI 辅助思维」的产品调性。\n\n下次选色时，先问自己：我想让用户感受到什么？答案就是你的调色板起点。' },
    { id: 'p4', title: '用思链整理了3年的设计笔记', image: 'https://images.unsplash.com/photo-1597514110707-b988d3a08652?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=1040&q=80', likes: 356, tall: true, date: '2025-02-12', readTime: '6 分钟', body: '三年，1247条零散笔记，47本速写本，无数张截图——这就是我的设计积累现状。在使用思链之前，我几乎不会翻看这些"宝藏"，因为找不到。\n\n经过两周的整理，思链帮我生成了一张知识图谱。让我震惊的是：「字体排印」节点居然和「认知负荷」节点有强连接，而这两条笔记相隔了整整两年。\n\n这就是知识图谱的魔力——它能发现**你自己都忘了的连接**。现在我的设计决策有了更坚实的理论支撑，不再只靠直觉。' },
    { id: 'p5', title: '交互动效的12条黄金法则', image: 'https://images.unsplash.com/photo-1615387000571-bdcfe92eb67c?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=720&q=80', likes: 187, tall: false, date: '2025-02-09', readTime: '5 分钟', body: '好的动效是隐形的——用户感受不到它的存在，但没有它会明显感到"哪里不对"。这是交互动效设计的最高境界。\n\n我整理了12条实践中验证过的法则，其中最重要的三条是：①遵循自然物理规律（弹性、惯性）；②持续时间在200-400ms最舒适；③动效要传递方向和层级，不能只是"好看"。\n\nMotion 库中的 spring 动画参数本质上是在模拟真实弹簧物理——stiffness（弹性）和 damping（阻尼）。理解了这两个参数，你就理解了所有流畅动效的秘密。' },
    { id: 'p6', title: '排版与可读性的深度研究', image: 'https://images.unsplash.com/photo-1769690398694-9c5d5ca4b4ea?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=960&q=80', likes: 73, tall: true, date: '2025-02-05', readTime: '4 分钟', body: '人眼在阅读时，不是逐字扫描，而是"跳跃"——每次跳跃落点叫做「注视点」，每次停留约200-250ms。优秀的排版设计，本质上是在优化注视点的落点位置。\n\n行宽45-75个字符是阅读的黄金区间。太短导致眼睛频繁换行，太长导致换行时丢失位置。行间距1.5-1.8是让文字"呼吸"的最佳比例。\n\n每次我看到移动端大段无间距的文字，都想替用户的眼睛喊疼。' },
    { id: 'p7', title: 'Figma 高效工作流分享', image: 'https://images.unsplash.com/photo-1654028122846-4910bf0db38c?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=600&q=80', likes: 445, tall: false, date: '2025-01-30', readTime: '3 分钟', body: '用了Figma三年，终于整理出一套让效率翻倍的工作流。核心思路是：**用 Auto Layout 代替手动排版，用 Variables 管理设计决策，用 Component Properties 减少重复组件**。\n\n最近发现的宝藏功能：Section + Cover Image，终于可以让文件结构一目了然。配合命名规范和组件文档，新成员上手时间从一周降到了两天。\n\n分享一个小技巧：Ctrl+Alt+G（Mac: Cmd+Opt+G）可以直接把选中内容包裹进 Auto Layout，每天用这个快捷键能省出喝咖啡的时间。' },
    { id: 'p8', title: '移动端 UI 趋势 2025', image: 'https://images.unsplash.com/photo-1597514110707-b988d3a08652?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=880&q=80', likes: 562, tall: true, date: '2025-01-25', readTime: '6 分钟', body: '2025年移动端设计最显著的三个趋势：**玻璃拟态 2.0**（更真实的景深与光线）、**触感反馈设计**（震动+视觉+声音的三维反馈体系）、**AI 自适应界面**（根据使用习惯动态调整布局）。\n\n其中最值得关注的是 AI 自适应界面——当 UI 能学习用户习惯时，设计师的工作重心会从"界面布局"转向"行为规则设计"。这是一个范式级别的转变。\n\nHi Brain 这款 App 本身就是这个趋势的最佳注脚：界面服务于思维，而不是反过来。' },
  ],
  '2': [
    { id: 'p1', title: '《心流》精华：进入专注状态的秘密', image: 'https://images.unsplash.com/photo-1687292291646-9bf8a20f99df?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=1040&q=80', likes: 342, tall: true, date: '2025-02-20', readTime: '5 分钟', body: '米哈里·契克森米哈伊在《心流》中描述了一种神奇的状态：时间消失了，自我消失了，只剩下你和那件事情本身。这就是心流。\n\n触发心流的关键条件是：**挑战与技能的完美匹配**。太简单会无聊，太难会焦虑，只有刚好在边缘地带，才能进入心流。这解释了为什么好游戏让人停不下来——它一直在动态调整难度，让你永远处于"稍微够得到"的状态。\n\n用这个框架重新审视学习：找到你当前技能边界上的任务，那就是你的心流入口。' },
    { id: 'p2', title: '游戏化学习：让大脑主动上瘾', image: 'https://images.unsplash.com/photo-1748609422318-7301636fb625?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=600&q=80', likes: 178, tall: false, date: '2025-02-17', readTime: '4 分钟', body: '大脑讨厌枯燥，热爱游戏。不是因为我们懒，而是因为进化给了我们一套完美的奖励系统——多巴胺。问题是：传统教育不会触发这套系统。\n\n游戏化学习的核心不是"把学习变成游戏"，而是**把游戏让人上瘾的底层机制移植到学习中**：即时反馈、明确进度、可见成就、社交竞争。\n\nHi Brain 的思库功能就是这个思路的实践——每次完成一条笔记，都有一个小小的完成动画。看似微不足道，但神经科学告诉我们：这0.3秒的反馈，足以改变大脑对"记笔记"这件事的情感标签。' },
    { id: 'p3', title: '费曼技巧：用输出倒逼输入', image: 'https://images.unsplash.com/photo-1649220058039-e81e690e28ef?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=720&q=80', likes: 256, tall: false, date: '2025-02-14', readTime: '3 分钟', body: '费曼说：如果你不能用简单的话解释一个概念，那你就没真正理解它。费曼技巧的四步法是：学习概念→用简单语言解释→找到卡壳点→回去深化理解。\n\n我用这个技巧学习完《黑天鹅》后写了一篇总结，结果发现自己对"反脆弱"的理解是错的——我以为的和塔勒布真正说的完全不同。输出，才是检验理解的唯一标准。\n\n建议：读完每一章，立刻用自己的话写100字总结，不允许引用原文。这个习惯会让你的读书效率提升三倍。' },
    { id: 'p4', title: '番茄工作法进阶版实践报告', image: 'https://images.unsplash.com/photo-1687292291646-9bf8a20f99df?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=960&q=80', likes: 134, tall: true, date: '2025-02-10', readTime: '4 分钟', body: '标准番茄工作法：25分钟工作+5分钟休息。实践三个月后，我发现这个公式过于僵化。于是我开发了一个"弹性番茄"方案。\n\n核心改动：用"感觉疲惫时"替代"计时器响时"作为休息触发条件。这听起来很主观，但配合每次记录当时的专注状态（1-5分），两周后数据就会告诉你你的个人最优工作节律。\n\n我的数据：上午10:00-11:30是深度工作黄金期，下午3:00-4:30是第二个高峰，夜间效率最低但创意最好。你的呢？' },
    { id: 'p5', title: '《刻意练习》：天才背后的秘密', image: 'https://images.unsplash.com/photo-1748609422318-7301636fb625?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=640&q=80', likes: 89, tall: false, date: '2025-02-06', readTime: '5 分钟', body: '安德斯·艾瑞克森研究了数十年的"天才"，结论让人惊讶：天才基本上是刻意练习的产物，而非天生的。\n\n刻意练习有三个关键：①始终在舒适区边缘练习；②获得即时的、高质量的反馈；③专注于纠正具体的弱点，而非重复已经掌握的技能。\n\n普通练习 vs 刻意练习的区别：你是在享受已经擅长的事情，还是在痛苦地挑战刚好够不到的目标？只有后者才能真正提升。这解释了为什么很多人"工作了十年却没有十年的成长"。' },
    { id: 'p6', title: '2025年必读书单：10本改变思维', image: 'https://images.unsplash.com/photo-1649220058039-e81e690e28ef?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=1000&q=80', likes: 671, tall: true, date: '2025-02-02', readTime: '3 分钟', body: '精选10本真正改变了我思维模式的书，每一本都值得反复读：《穷查理宝典》《思考，快与慢》《黑天鹅》《心流》《刻意练习》《原则》《清醒思考的艺术》《为什么伟大不能被计划》《具身认知》《第二座山》。\n\n选书标准：不是"畅销"或"流行"，而是"读完之后，我看世界的方式永久改变了"。\n\n真正好书的标志：你读完后，会自动开始用书里的框架分析生活中遇到的每件事。《思考，快与慢》让我在每次冲动决策时都听到卡尼曼在旁边低语。' },
    { id: 'p7', title: '间隔重复：记忆术的科学依据', image: 'https://images.unsplash.com/photo-1687292291646-9bf8a20f99df?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=560&q=80', likes: 203, tall: false, date: '2025-01-28', readTime: '4 分钟', body: '大脑不是硬盘——信息不是存进去就不会丢失的。遗忘曲线告诉我们：如果不复习，24小时内会遗忘70%。\n\n间隔重复（Spaced Repetition）的原理：在即将忘记之前复习，会让记忆痕迹加深，下次遗忘周期变长。最优复习间隔通常是1天→3天→7天→21天→60天。\n\nAnki 这个软件把这个算法自动化了。我用Anki学英语单词两年，单词量从3000增长到12000，每天只需15分钟维护。复利效应不只在金融领域有效——它在学习中更强大。' },
    { id: 'p8', title: '深度工作与浅层工作的边界', image: 'https://images.unsplash.com/photo-1748609422318-7301636fb625?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=920&q=80', likes: 418, tall: true, date: '2025-01-22', readTime: '5 分钟', body: '卡尔·纽波特在《深度工作》中做了一个残酷的区分：深度工作（Deep Work）是在无干扰状态下进行的、需要认知高度参与的工作；浅层工作（Shallow Work）是那些可以在分心状态下进行的、不需要太多认知的任务。\n\n问题是：现代工作环境几乎是专门为阻碍深度工作而设计的——开放办公、即时通讯、无穷尽的会议。\n\n我的解法：每天上午的第一个2小时是神圣的深度工作时间，手机静音，关闭所有通知，只做最重要的一件事。这两个小时的产出，往往超过其余六个小时的总和。' },
  ],
  '3': [
    { id: 'p1', title: 'React Server Components 完整指南', image: 'https://images.unsplash.com/photo-1770734360042-676ef707d022?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=1000&q=80', likes: 256, tall: true, date: '2025-02-22', readTime: '8 分钟', body: 'RSC（React Server Components）是 React 架构的范式转变，不只是"SSR的升级版"。核心区别在于：RSC 的组件树在**服务器上永久存在**，客户端组件是"岛屿"，嵌入在服务端渲染的海洋中。\n\n这带来了革命性的优势：服务端组件的代码**完全不发送到客户端**——数据库查询、文件读取、重型计算，都在服务器上完成，浏览器只收到渲染结果。\n\n实践建议：先把所有组件默认设为 Server Components，只在需要 useState/useEffect/事件处理时才加 "use client" 指令。你会惊讶地发现，大部分组件根本不需要在客户端运行。' },
    { id: 'p2', title: 'Zustand vs Redux：选型决策树', image: 'https://images.unsplash.com/photo-1770734360042-676ef707d022?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=640&q=80', likes: 189, tall: false, date: '2025-02-19', readTime: '4 分钟', body: '简单版决策树：如果你的项目需要时间旅行调试、严格的状态变更记录、大型团队协作——选Redux Toolkit。其他所有情况——选Zustand。\n\nZustand 的代码量是 Redux 的1/5，心智负担是 Redux 的1/10。创建一个 store 只需要8行代码。\n\n我在实际项目中的迁移经历：把一个中型电商项目从 Redux 迁移到 Zustand，代码量减少了60%，bug率降低了40%，新成员上手时间从三天缩短到半天。当然这个数据有点夸张——但方向是对的。' },
    { id: 'p3', title: 'TypeScript 类型体操：从入门到精通', image: 'https://images.unsplash.com/photo-1678845536613-5cf0ec5245cd?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=720&q=80', likes: 334, tall: false, date: '2025-02-16', readTime: '7 分钟', body: 'TypeScript 类型系统是图灵完备的——这意味着你可以用类型来"编程"。听起来很酷，但"类型体操"是一把双刃剑：过度使用会让代码变得比不用类型还难维护。\n\n实用原则：**能用简单类型解决的，绝不用复杂泛型**。Conditional Types、Template Literal Types、Mapped Types——这些工具很强大，但它们的最佳使用场景是库的开发，而不是业务代码。\n\n最近整理了一份"TypeScript 实用工具类型手册"，收录了50个真实项目中高频使用的类型定义。用思库管理后，下次遇到类型问题直接搜索，再也不用重复造轮子。' },
    { id: 'p4', title: 'AI 辅助编程的正确姿势', image: 'https://images.unsplash.com/photo-1770734360042-676ef707d022?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=960&q=80', likes: 512, tall: true, date: '2025-02-13', readTime: '5 分钟', body: 'AI 编程助手改变了工作流，但用错了反而会降低效率。我总结了三个阶段的使用哲学。\n\n**初级**：把 AI 当搜索引擎用，让它生成代码片段，复制粘贴。这阶段效率确实提升，但你在"消费"知识，而不是建立理解。**中级**：把 AI 当结对程序员，描述问题，让它提供思路，自己动手实现。**高级**：把 AI 当审查员，自己先设计和实现，然后让 AI 找问题、提优化建议。\n\n真正的生产力提升不是让 AI 替你写代码，而是让 AI 帮你**思考得更深**。' },
    { id: 'p5', title: 'Vite 配置优化：构建速度提升 80%', image: 'https://images.unsplash.com/photo-1678845536613-5cf0ec5245cd?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=600&q=80', likes: 147, tall: false, date: '2025-02-09', readTime: '4 分钟', body: '一个中型 React 项目从 Webpack 迁移到 Vite 后，冷启动从42秒降到了3秒。热更新从2-4秒降到了<100ms。这不是优化，这是质变。\n\n但 Vite 本身也有优化空间。三个最有效的配置：①启用 build.target: "esnext" 减少转译负担；②使用 vite-plugin-checker 把类型检查移到单独线程；③合理配置 optimizeDeps.include 避免重复预构建依赖。\n\n另一个经常被忽视的点：生产环境的 rollupOptions.output.manualChunks 配置合理，可以让首屏 JS 体积减少40%以上。' },
    { id: 'p6', title: '前端性能优化：Core Web Vitals', image: 'https://images.unsplash.com/photo-1770734360042-676ef707d022?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=1040&q=80', likes: 276, tall: true, date: '2025-02-05', readTime: '6 分钟', body: 'Google 的 Core Web Vitals 三个核心指标：LCP（最大内容渲染）<2.5s、INP（交互到绘制）<200ms、CLS（累积布局偏移）<0.1。达标的网站在 Google 搜索中有排名加成，但更重要的是用户体验。\n\n实践中最容易被忽视的 CLS 问题：图片没有设置固定宽高比、字体加载时的布局抖动、动态注入的内容。解法：对所有图片使用 aspect-ratio 或明确的 width/height；用 font-display: optional 避免字体引起的 FOUT。\n\n分享一个工具链：Lighthouse + WebPageTest + Chrome DevTools Performance 面板，三者结合能定位95%的性能瓶颈。' },
    { id: 'p7', title: 'Tailwind CSS v4 新特性解读', image: 'https://images.unsplash.com/photo-1678845536613-5cf0ec5245cd?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=560&q=80', likes: 391, tall: false, date: '2025-01-31', readTime: '4 分钟', body: 'Tailwind CSS v4 是一次架构级重写。最大的变化：**不再需要 tailwind.config.js**——所有配置直接在 CSS 中用 @theme 定义，工具链从 PostCSS 迁移到了 LightningCSS，速度提升了35%。\n\n新增的 @starting-style 支持让入场动画变得极简——终于不需要 JavaScript 就能做出流畅的元素出现效果。\n\n个人最喜欢的新特性：field-sizing: content 让 textarea 自动根据内容调整高度，以前这个需要写 JS，现在一个 CSS 属性搞定。Tailwind 的 @apply 哲学：让 CSS 服务于组件，而不是让组件服务于 CSS。' },
    { id: 'p8', title: '思链 + 代码知识库：我的 PKM 系统', image: 'https://images.unsplash.com/photo-1770734360042-676ef707d022?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=920&q=80', likes: 628, tall: true, date: '2025-01-26', readTime: '5 分钟', body: '经过6个月的迭代，我终于建立了一套稳定运行的个人知识管理系统（PKM）。思库存储原子笔记，思链构建知识图谱，代码片段库管理可复用的实现模式。\n\n系统的核心原则：**每条知识都有出处、都有连接、都有应用场景**。孤立的知识会遗忘，连接的知识会增值。\n\n这套系统已经帮我避免了"已经解决过这个问题"的尴尬状况。上次遇到 React hydration 的 bug，直接在思库里搜到了两年前的解决方案，节省了3小时的调试时间。知识资产的复利，比代码复用更值钱。' },
  ],
  '4': [
    { id: 'p1', title: '京都寺庙：在静中感受时间的重量', image: 'https://images.unsplash.com/photo-1717060773466-2bd7b1039f85?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=1080&q=80', likes: 512, tall: true, date: '2025-02-21', readTime: '4 分钟', body: '金阁寺倒映在镜湖里，秋叶的红与金融进水面，整个世界安静得只剩心跳声。这是我34个国家旅行中，第一次感受到"静"是有重量的。\n\n日本人称这种美为「物の哀れ」（mono no aware）——对事物无常之美的温柔悲伤。不是西方审美中的"美丽"，而是一种因为"知道它会消逝"而更加珍惜的凝视。\n\n用 Hi Brain 整理旅行笔记时，AI 发现我在「京都」「冰岛」「西藏」的笔记中都反复出现"沉默"这个词。原来我一直在寻找的，是同一种东西。' },
    { id: 'p2', title: '冰岛极光：渺小的震撼', image: 'https://images.unsplash.com/photo-1681834418277-b01c30279693?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=680&q=80', likes: 891, tall: false, date: '2025-02-18', readTime: '3 分钟', body: '零下20度，仰头，绿色的光幕在整个天空流动，像一条活着的河。站在那里，忽然理解了为什么古人会对天象产生宗教感——当你感受到自己的渺小，某种莫名的平静随之而来。\n\n极光是太阳风与地球磁场碰撞产生的等离子体发光。知道这个物理原理并不会减损它的神奇，反而让我多了一层震撼——宇宙级别的物理现象，就在你头顶上演。\n\n极光旅行Tips：最佳时期9-3月，最好的地点是远离城市光污染的内陆。我推荐冰岛东部小镇胡萨维克，游客稀少，夜空更纯净。' },
    { id: 'p3', title: '旅行中的灵感捕捉系统', image: 'https://images.unsplash.com/photo-1601907482852-9b02d7a8716f?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=760&q=80', likes: 234, tall: false, date: '2025-02-15', readTime: '4 分钟', body: '最好的旅行灵感总在最不方便的时候出现——在颠簸的巴士上、在瓢泼大雨中、在海拔4000米气喘吁吁时。所以我的捕捉系统必须轻量到极致。\n\n我的三层捕捉工具：①随身小本子（最快，不需要开锁）；②手机备忘录语音记录（双手占用时）；③Hi Brain 拍照+AI解析（把速写本、菜单、标牌上的信息秒变结构化笔记）。\n\n关键原则：捕捉时不评判、不整理，只是忠实记录那个瞬间的感受。回家后再用思库整理，让AI帮你发现那些你旅行中自己都没注意到的模式。' },
    { id: 'p4', title: '34个国家旅行教会我的事', image: 'https://images.unsplash.com/photo-1717060773466-2bd7b1039f85?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=1000&q=80', likes: 1203, tall: true, date: '2025-02-11', readTime: '6 分钟', body: '10年，34个国家，这些旅行教会了我一件最重要的事：**世界上没有"正确的"生活方式，只有不同的选择**。\n\n在日本，我学到了精致和克制；在摩洛哥，我学到了热烈和当下；在北欧，我学到了简约和平等；在印度，我学到了混沌中的生命力。没有哪一种更好，但每一种都在拓展我对"可能性"的想象边界。\n\nAI 帮我分析3年旅行笔记后，找到了一条我自己都没意识到的规律：我在"非旅游景点"写的笔记，质量是"著名景点"的三倍。原来我真正热爱的不是旅行，而是**陌生感**。' },
    { id: 'p5', title: '孤独与创意：为什么一个人旅行', image: 'https://images.unsplash.com/photo-1681834418277-b01c30279693?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=640&q=80', likes: 678, tall: false, date: '2025-02-07', readTime: '3 分钟', body: '第一次一个人旅行时，在葡萄牙的咖啡馆坐了整整一个下午，什么都没做——既没有拍照，也没有写作，只是看着街上的人来人往。回来后写了三篇我认为迄今为止最好的文章。\n\n孤独是创意的培养皿。当你不需要回应任何人的期待，不需要照顾任何人的感受，你才能真正听见自己内心那个更微弱的声音——那才是真正属于你的想法。\n\n这就是为什么我每年至少有两次独自旅行。不是因为找不到同伴，而是因为某些感受只有孤独才能让你抵达。' },
    { id: 'p6', title: '用 AI 整理3年旅行笔记的实验', image: 'https://images.unsplash.com/photo-1601907482852-9b02d7a8716f?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=960&q=80', likes: 445, tall: true, date: '2025-02-03', readTime: '5 分钟', body: '花了两周时间，把3年、34个国家、1400多条旅行笔记全部导入 Hi Brain。AI 生成的知识图谱让我愣了很久。\n\n最惊人的发现：我关于「食物」的笔记数量，是关于「建筑」的4倍。我以为自己是个建筑迷，但数据告诉我：我更是个吃货。\n\n第二个发现：所有我标记为"人生最美好体验"的笔记，背景条件惊人地一致：独处、天气好、没有行程压力、遇到了一个有趣的陌生人。这四个条件同时满足时，神奇就会发生。现在我在安排旅行时，会刻意创造这四个条件。' },
    { id: 'p7', title: '旅行轻量化：只带一个15L背包', image: 'https://images.unsplash.com/photo-1717060773466-2bd7b1039f85?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=600&q=80', likes: 312, tall: false, date: '2025-01-29', readTime: '3 分钟', body: '曾经我带着28寸行李箱去旅行，现在我只带15L的日包，甚至去欧洲三周也是这样。这不是苦行，而是一种解放。\n\n轻量化旅行的核心：**每件物品要么每天用，要么在当地买**。衣服？3件内衣+2件T恤+1件外套，按需洗。书？电子书。备用药？目的地药店都有。\n\n最大的收获不是省了托运费，而是：当你不再被行李束缚，你才真正自由了——可以说走就走，可以住青旅，可以坐最早的班车，可以改变计划。行李是物质的，但它束缚的是精神自由度。' },
    { id: 'p8', title: '北欧极简生活与日式侘寂美学', image: 'https://images.unsplash.com/photo-1681834418277-b01c30279693?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=880&q=80', likes: 567, tall: true, date: '2025-01-24', readTime: '4 分钟', body: '在斯德哥尔摩生活了三个月，在京都住过一次民宿。两种文化的美学追求表面相似，内核却截然不同。\n\n北欧极简是功能驱动的——去掉一切不必要的装饰，让功能本身成为美。日式侘寂是哲学驱动的——拥抱不完美、无常、未完成，在残缺中寻找美。前者是向外的清洁，后者是向内的接受。\n\n两者给我的共同启示：**拥有更少，才能感受更多**。无论是设计还是生活，克制不是放弃，而是一种更高级的选择能力。我现在的家里，只有我真正喜欢的东西——每一件都足以让我开心。' },
  ],
  '5': [
    { id: 'p1', title: '用知识图谱对抗信息焦虑的方法论', image: 'https://images.unsplash.com/photo-1678845536613-5cf0ec5245cd?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=1000&q=80', likes: 687, tall: true, date: '2025-02-22', readTime: '6 分钟', body: '信息焦虑的本质是什么？不是"信息太多"，而是"信息之间没有关系"。当你面对一堆碎片时，大脑无法建立秩序感，焦虑随之而来。\n\n知识图谱的意义不是存储更多信息，而是**把碎片变成网络**。一个节点连接到10个其他节点，它的价值就是孤立节点的10倍以上。\n\n我的实践数据：用思链整理3个月后，我订阅的信息源从40个减少到了7个，但实际产出的有价值想法增加了3倍。当你能把新信息快速接入已有知识网络时，你会开始对信息有鉴别力——不能连接的信息，根本不值得存储。' },
    { id: 'p2', title: '第一���理：从底层重建你的认知', image: 'https://images.unsplash.com/photo-1615387000571-bdcfe92eb67c?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=640&q=80', likes: 423, tall: false, date: '2025-02-19', readTime: '5 分钟', body: '第一原理思维（First Principles Thinking）是马斯克频繁提到的思维工具，但很少有人说清楚它到底是什么，以及如何实践。\n\n核心定义：不依赖类比和惯例，把问题分解到最基础的、不可再分的"公理"层面，然后从零构建解决方案。与之相对的是"类比推理"——这是我们大多数时候使用的思维模式，但它注定只能产生渐进式改良，无法产生真正的突破。\n\n实践方法：面对任何问题，连续问5次"为什么"。当你再也无法继续往下问时，就到达了第一原理层。然后从那里重新往上构建，你会发现很多"理所当然"的假设根本站不住脚。' },
    { id: 'p3', title: '思链使用心得：500条碎片的整理', image: 'https://images.unsplash.com/photo-1678845536613-5cf0ec5245cd?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=720&q=80', likes: 891, tall: false, date: '2025-02-16', readTime: '4 分钟', body: '用了半年思链，整理了500多条笔记，总结出三个最有价值的使用经验。\n\n第一：**标签要少而精**。我最开始给每条笔记打5-8个标签，结果标签泛滥，图谱一团乱麻。现在每条笔记最多3个标签，图谱清晰了10倍。\n\n第二：**双向连接比单向连接强大10倍**。当A笔记连接B的同时，主动问"B里有没有连回A的价值"。这种双向确认过程，本身就是一次深度复习。\n\n第三：**定期做"孤岛清除"**。每月审视一次没有任何连接的孤立节点，要么删除它，要么找到它与其他节点的关系。孤岛笔记通常是你没真正思考清楚的信息。' },
    { id: 'p4', title: '费曼 vs 苏格拉底：两种思维训练法', image: 'https://images.unsplash.com/photo-1615387000571-bdcfe92eb67c?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=960&q=80', likes: 334, tall: true, date: '2025-02-12', readTime: '5 分钟', body: '费曼技巧和苏格拉底式问答，表面上都是"用提问深化理解"，但方向正好相反。\n\n费曼技巧是**向外输出**——用你能理解的最简单语言解释一个概念，暴露你的认知盲点，然后回去填补。苏格拉底式问答是**向内挖掘**——通过不断追问"为什么"，拆解你以为已经理解的信念，直到抵达它的逻辑基础。\n\n两者结合使用效果最强：先用苏格拉底法把一个概念拆解到底，再用费曼法把它重新构建并表达出来。这个循环走完一遍，你会发现理解的深度跟以前完全不一样了。' },
    { id: 'p5', title: '每天输入 ≠ 成长：知识消化的秘密', image: 'https://images.unsplash.com/photo-1678845536613-5cf0ec5245cd?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=600&q=80', likes: 156, tall: false, date: '2025-02-08', readTime: '3 分钟', body: '我认识很多每天阅读2小时的人，但他们的思维和认知水平在三年后和三年前几乎没有变化。知识焦虑让他们拼命输入，但没有人告诉他们：**输入不等于吸收，吸收不等于成长**。\n\n真正的知识消化需要三个环节：理解（能复述）→ 连接（能与已有知识关联）→ 应用（能用来解决实际问题）。大部分人停在第一步就以为完成了。\n\n我现在的学习配比是：输入30%，连接整理40%，应用输出30%。每减少一小时阅读，增加一小时输出，是我做过的最有效的学习习惯改变。' },
    { id: 'p6', title: '认知科学视角下的学习迁移', image: 'https://images.unsplash.com/photo-1758657286956-f944e1d2e75a?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=1040&q=80', likes: 278, tall: true, date: '2025-02-04', readTime: '5 分钟', body: '学习迁移（Transfer of Learning）是认知科学中最迷人也最被低估的概念：在A领域学到的东西，如何帮助你理解B领域？\n\n研究表明，促进迁移的关键不是"学了多少内容"，而是"理解了多少底层原理"。掌握了物理学中的"系统平衡"原理，你会发现它也适用于生态学、经济学、组织管理……\n\n这就是为什么跨领域学习者往往更有创造力——他们拥有更多可以互相连接的"原理模块"。知识图谱的价值也在于此：它强迫你寻找不同领域之间的连接，从而加速迁移学习。' },
    { id: 'p7', title: '心智模型清单：25个必备思维框架', image: 'https://images.unsplash.com/photo-1678845536613-5cf0ec5245cd?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=560&q=80', likes: 1124, tall: false, date: '2025-01-30', readTime: '4 分钟', body: '查理·芒格说：拥有100个心智模型，就相当于拥有了100种看世界的眼睛。这是真的——但更重要的是：你需要的不是100个，而是把最重要的25个用到烂熟于心的程度。\n\n我整理的最高频使用的五个：①二阶思维（想清楚决策的次级和三级后果）；②机会成本（选择A意味着放弃的最佳B）；③反向思维（先想什么情况会失败，再回推如何成功）；④幸存者偏差（我们看到的成功案例，是所有案例中的幸存者）；⑤能力圈原则（只在你有竞争优势的领域下重注）。\n\n每个模型都已存入思库，标注了定义、应用场景、典型案例。随时可以搜索和链接。' },
    { id: 'p8', title: '反脆弱思维：在混乱中成长', image: 'https://images.unsplash.com/photo-1758657286956-f944e1d2e75a?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=920&q=80', likes: 567, tall: true, date: '2025-01-25', readTime: '5 分钟', body: '塔勒布在《反脆弱》中提出的核心思想改变了我对风险的理解：脆弱的事物在波动中受损，坚韧的事物在波动中不受影响，而反脆弱的事物——**在波动中变得更强**。\n\n反脆弱不是坚强，不是无所畏惧，而是一种从混乱中获益的能力。锻炼让身体承受压力变得更强；失败让判断力承受冲击变得更准；知识体系的反脆弱性来自于：当你遇到挑战时，不是去保护现有的理解，而是让挑战重塑和加深它。\n\n实践方法：把每一次"被推翻的认知"视为礼物，而不是羞辱。更新世界观的那一刻，就是反脆弱发生的那一刻。' },
  ],
  '6': [
    { id: 'p1', title: '手写笔记30天实验：记忆力提升40%', image: 'https://images.unsplash.com/photo-1748609422318-7301636fb625?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=1040&q=80', likes: 923, tall: true, date: '2025-02-20', readTime: '4 分钟', body: '2025年1月，我做了一个实验：连续30天，所有新知识只用手写，禁止任何数字设备记录。结果出乎我的意料。\n\n第一周很痛苦——手速跟不上思维速度，大量信息来不及记录。但第二周开始，我发现一个神奇的现象：因为手写慢，我开始**被迫筛选**——只记最重要的，用自己的话而不是原文。这个被动筛选过程，让我对内容的理解深度提升了约3倍。\n\n30天后复测：手写记录的内容记忆留存率比数字记录高38-42%（小样本，仅供参考）。神经科学的解释：手写激活了大脑中与学习和记忆密切相关的运动皮层。' },
    { id: 'p2', title: '数字笔记连接规则：每条至少2个节点', image: 'https://images.unsplash.com/photo-1710447503692-8364152e431c?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=640&q=80', likes: 334, tall: false, date: '2025-02-17', readTime: '3 分钟', body: '有一条规则彻底改变了我的数字笔记质量：**每条新笔记入库前，必须找到至少2个它能连接的已有笔记**。如果找不到，就不入库。\n\n这条规则看起来很严苛，但实践效果惊人。它强迫我在记录之前就思考：这条信息和我已知的什么有关？它适用在哪里？它挑战了我的什么已有认知？\n\n经过6个月的实践，我的笔记总量从2000条减少到了800条，但每条的价值密度提升了至少5倍。少即是多，在知识管理中也完全成立。' },
    { id: 'p3', title: 'Obsidian + 思库：我的双轨笔记法', image: 'https://images.unsplash.com/photo-1748609422318-7301636fb625?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=720&q=80', likes: 445, tall: false, date: '2025-02-13', readTime: '4 分钟', body: 'Obsidian 负责深度知识构建，思库负责快速捕捉和 AI 处理——两个工具分工明确，形成互补。\n\nObsidian 的优势：本地存储、Markdown原生支持、强大的双向链接可视化、无限扩展的插件生态。思库的优势：移动端体验极佳、AI 自动生成摘要和标签、知识图谱自动渲染、随时随地快速输入。\n\n工作流：移动端随手用思库记录灵感和碎片 → 每周日晚上把重要笔记导出整理进 Obsidian → Obsidian 里做深度连接和长文写作。两者结合，我同时拥有了"快"和"深"。' },
    { id: 'p4', title: '混合记录法：手写 → 拍照 → AI整理', image: 'https://images.unsplash.com/photo-1710447503692-8364152e431c?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=1000&q=80', likes: 678, tall: true, date: '2025-02-09', readTime: '3 分钟', body: '最佳笔记工作流只需三步：手写捕捉（5分钟）→ 拍照上传思库（30秒）→ AI 自动结构化（2分钟）。\n\n手写阶段不需要任何格式——关键词、思维导图、随手涂鸦都可以。速度是第一优先级。拍照时尽量保证光线均匀，思库的 OCR 识别率会更高。\n\nAI 整理后会生成：标题、摘要、关键词、相关笔记推荐。这个工作流的神奇之处在于：它保留了手写的记忆优势，又获得了数字化的搜索和连接能力。鱼与熊掌，可以兼得。' },
    { id: 'p5', title: '笔记本选购指南：纸张、格子与封面', image: 'https://images.unsplash.com/photo-1748609422318-7301636fb625?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=600&q=80', likes: 189, tall: false, date: '2025-02-05', readTime: '3 分钟', body: '我试过市面上几十种笔记本，最终形成了一套选购标准。纸张克重：80g以上才能正反面书写不透；格式：5mm点阵格兼顾自由书写和图表绘制，是我最推荐的格式；装订：平摊式装订让双手解放，翻开后两页完全平整。\n\n目前主力本：日本国誉方格B5（日常使用）、Leuchtturm1917点阵A5（随身携带）。前者性价比极高，后者纸质顺滑适合钢笔。\n\n笔记本的封面材质也有讲究：软皮封面更适合单手握持记录，硬皮更适合伏案书写。根据你的主要使用场景选择，不要被"颜值"绑架——你的笔记本是工具，不是摆设。' },
    { id: 'p6', title: '子弹笔记 vs 康奈尔笔记法比较', image: 'https://images.unsplash.com/photo-1710447503692-8364152e431c?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=960&q=80', likes: 267, tall: true, date: '2025-02-01', readTime: '4 分钟', body: '两种方法都有大量拥趸，但适用场景完全不同。理解这一点，才能找到真正适合你的方案。\n\n子弹笔记的核心是**记录系统**——用符号区分任务、事件、笔记，配合迁移机制管理待办事项。它更像一个极简的 GTD 系统，适合需要同时管理任务和笔记的人。\n\n康奈尔笔记法的核心是**知识获取**——将页面分为笔记区、线索区、总结区，强制你在记录后进行提炼和回顾。它更像一个学习加速器，适合听课、读书时的主动学习。\n\n我的方案：周计划和任务管理用子弹笔记，阅读和学习用康奈尔法。两者互不干扰，各司其职。' },
    { id: 'p7', title: '好奇心驱动学习的神经科学基础', image: 'https://images.unsplash.com/photo-1748609422318-7301636fb625?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=560&q=80', likes: 512, tall: false, date: '2025-01-28', readTime: '4 分钟', body: '当你好奇时，大脑会发生什么？神经科学告诉我们：好奇心激活多巴胺系统，增强海马体的记忆编码能力——简单说，好奇状态下学到的东西，记得更牢。\n\n2014年加州大学的研究发现：当受试者对问题感到好奇时，对这个问题的记忆提升了30%，同时对同期不相关内容的记忆也提升了23%。好奇心创造的记忆"窗口"会溢出，让整段时间内的所有学习都更高效。\n\n实践应用：在开始任何学习任务前，先给自己提一个真正让你好奇的问题。哪怕这个问题和学习内容只有边缘关系，它创造的多巴胺环境会让接下来一个小时的学习效率显著提升。' },
    { id: 'p8', title: '每周回顾模板：让笔记真正产生价值', image: 'https://images.unsplash.com/photo-1710447503692-8364152e431c?crop=entropy&cs=tinysrgb&fit=crop&w=800&h=920&q=80', likes: 834, tall: true, date: '2025-01-24', readTime: '3 分钟', body: '笔记不是目的，**笔记被回顾和使用才是目的**。没有回顾机制的笔记系统，是一个写入不读出的黑洞。\n\n我的每周回顾模板（每周日晚上，30分钟）：①本周新增笔记中，哪3条最有价值？②它们和之前的笔记有什么新的连接？③有没有发现新的"知识空白"值得下周深入学习？④清理孤岛笔记，删除或连接。\n\n坚持这个模板12周后，我发现一个惊人现象：我开始主动"为笔记设计出口"——在记录时就想好这条笔记会在什么场景被用到。这种前瞻性思维，让我的笔记质量提升了整整一个量级。' },
  ],
};

// ── Mock comments ─────────────────────────────────────────────────────────────
const MOCK_DETAIL_COMMENTS = [
  { id: 'c1', user: '学习狂魔', color: '#6366F1', letter: '学', text: '这篇写得太好了！完全说出了我的困惑，收藏了！', time: '1小时前', likes: 34 },
  { id: 'c2', user: '知识守门人', color: '#8B5CF6', letter: '知', text: '第二段的观点很有共鸣，我在实践中也得出了类似的结论。', time: '3小时前', likes: 18 },
  { id: 'c3', user: '思维探索者', color: '#3B82F6', letter: '思', text: '能出一个系列吗？感觉这个方向还可以深挖很多。', time: '昨天', likes: 56 },
  { id: 'c4', user: '好奇宝宝', color: '#10B981', letter: '好', text: '请问这个方法适合初学者吗？有没有更基础的入门版？', time: '2天前', likes: 9 },
];

const TABS = ['笔记', '喜欢', '收藏'] as const;
type Tab = typeof TABS[number];

function formatLikes(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

// ── PostDetailSheet ───────────────────────────────────────────────────────────
function PostDetailSheet({ post, layoutId, color, profile, onClose }: {
  post: GridPost;
  layoutId: string;
  color: string;
  profile: typeof USER_PROFILES[string];
  onClose: () => void;
}) {
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(MOCK_DETAIL_COMMENTS);
  const [showShareToast, setShowShareToast] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const dragY = useRef(0);

  const handleLike = () => {
    setLiked(v => {
      setLikeCount(c => v ? c - 1 : c + 1);
      if (!v) { setHeartBurst(true); setTimeout(() => setHeartBurst(false), 600); }
      return !v;
    });
  };

  const handleShare = () => {
    setShowShareToast(true);
    setTimeout(() => setShowShareToast(false), 2000);
  };

  const handleSendComment = () => {
    if (!commentText.trim()) return;
    setComments(prev => [{
      id: `new-${Date.now()}`, user: '我', color, letter: profile.avatarLetter,
      text: commentText.trim(), time: '刚刚', likes: 0,
    }, ...prev]);
    setCommentText('');
  };

  const paragraphs = post.body.split('\n\n');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(10,8,30,0.65)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      {/* Sheet */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32, delay: 0.04 }}
        className="w-full max-w-lg relative flex flex-col overflow-hidden"
        style={{
          height: '94vh',
          background: 'rgba(253,253,255,0.98)',
          backdropFilter: 'blur(20px)',
          borderRadius: '28px 28px 0 0',
        }}
        onClick={e => e.stopPropagation()}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.18 }}
        onDrag={(_, info) => { dragY.current = info.offset.y; }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 600) onClose();
        }}
      >
        {/* ── Drag handle ── */}
        <div className="flex justify-center pt-3 pb-0 flex-shrink-0 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(30,27,75,0.15)' }} />
        </div>

        {/* ── Close button ── */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(30,27,75,0.08)' }}
        >
          <X size={16} style={{ color: '#6B7280' }} />
        </motion.button>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: '88px' }}>

          {/* Hero image — shares layoutId with card thumbnail */}
          <motion.div
            layoutId={`container-${layoutId}`}
            className="relative w-full overflow-hidden"
            style={{ height: '54vw', maxHeight: '300px', minHeight: '200px' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <motion.img
              layoutId={layoutId}
              src={post.image}
              alt={post.title}
              className="w-full h-full object-cover"
              style={{ display: 'block' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            />
            {/* Gradient overlay */}
            <div
              className="absolute inset-x-0 bottom-0 h-28 pointer-events-none"
              style={{ background: 'linear-gradient(to top, rgba(253,253,255,1) 0%, rgba(253,253,255,0.6) 50%, transparent 100%)' }}
            />
            {/* Double-tap heart burst */}
            <AnimatePresence>
              {heartBurst && (
                <motion.div
                  key="burst"
                  initial={{ scale: 0.4, opacity: 1, y: 0 }}
                  animate={{ scale: 2.2, opacity: 0, y: -40 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                >
                  <Heart size={56} fill="#EF4444" style={{ color: '#EF4444', filter: 'drop-shadow(0 0 16px rgba(239,68,68,0.6))' }} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── Content body ── */}
          <div className="px-5 pt-1 pb-2">
            {/* Author row */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="flex items-center gap-2.5 mb-3"
            >
              <div
                className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}20` }}
              >
                <span style={{ color, fontSize: '13px', fontWeight: 800 }}>{profile.avatarLetter}</span>
              </div>
              <div className="flex-1">
                <p style={{ color: '#1E1B4B', fontSize: '13px', fontWeight: 700 }}>{profile.name}</p>
                <p style={{ color: '#9CA3AF', fontSize: '11px' }}>{post.date} · {post.readTime}阅读</p>
              </div>
              {/* Reading progress pill */}
              <span
                className="px-2.5 py-1 rounded-full"
                style={{ background: `${color}10`, color, fontSize: '11px', fontWeight: 600 }}
              >
                {post.readTime}
              </span>
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              style={{ color: '#1E1B4B', fontSize: '20px', fontWeight: 900, lineHeight: 1.3, marginBottom: '12px' }}
            >
              {post.title}
            </motion.h2>

            {/* Divider */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.18, duration: 0.4 }}
              className="h-px mb-4 origin-left"
              style={{ background: `linear-gradient(to right, ${color}30, transparent)` }}
            />

            {/* Body paragraphs */}
            {paragraphs.map((para, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + i * 0.07 }}
                className="mb-4"
                style={{
                  color: '#374151',
                  fontSize: '14.5px',
                  lineHeight: 1.85,
                  // Bold text via dangerouslySetInnerHTML would require parsing — keep plain for safety
                }}
              >
                {para.replace(/\*\*(.*?)\*\*/g, '$1')}
              </motion.p>
            ))}

            {/* Tags */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.38 }}
              className="flex flex-wrap gap-2 mt-2 mb-4"
            >
              {profile.tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full"
                  style={{
                    background: `${color}0E`,
                    color,
                    fontSize: '12px',
                    fontWeight: 600,
                    border: `1px solid ${color}18`,
                  }}
                >
                  #{tag}
                </span>
              ))}
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42 }}
              className="flex items-center gap-4 py-3"
              style={{ borderTop: '1px solid rgba(0,0,0,0.05)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center gap-1.5" style={{ color: '#9CA3AF' }}>
                <Heart size={13} />
                <span style={{ fontSize: '12px' }}>{formatLikes(likeCount)}</span>
              </div>
              <div className="flex items-center gap-1.5" style={{ color: '#9CA3AF' }}>
                <MessageCircle size={13} />
                <span style={{ fontSize: '12px' }}>{comments.length}</span>
              </div>
              <div className="flex items-center gap-1.5" style={{ color: '#9CA3AF' }}>
                <Share2 size={13} />
                <span style={{ fontSize: '12px' }}>分享</span>
              </div>
            </motion.div>

            {/* ── Comments section ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.46 }}
              className="mt-4"
            >
              <button
                onClick={() => setShowComments(v => !v)}
                className="flex items-center gap-2 w-full mb-3"
              >
                <span style={{ color: '#1E1B4B', fontSize: '14px', fontWeight: 800 }}>
                  评论 ({comments.length})
                </span>
                <motion.div
                  animate={{ rotate: showComments ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                >
                  <ChevronDown size={16} style={{ color: '#9CA3AF' }} />
                </motion.div>
              </button>

              <AnimatePresence>
                {showComments && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="space-y-4 mb-4">
                      {comments.map((c, i) => (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex gap-3"
                        >
                          <div
                            className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${c.color}18` }}
                          >
                            <span style={{ color: c.color, fontSize: '12px', fontWeight: 700 }}>{c.letter}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span style={{ color: '#1E1B4B', fontSize: '12.5px', fontWeight: 700 }}>{c.user}</span>
                              <span style={{ color: '#9CA3AF', fontSize: '10.5px' }}>{c.time}</span>
                            </div>
                            <p style={{ color: '#4B5563', fontSize: '13px', lineHeight: 1.65 }}>{c.text}</p>
                            <button className="mt-1 flex items-center gap-1" style={{ color: '#9CA3AF', fontSize: '11px' }}>
                              <Heart size={10} /> {c.likes}
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>

        {/* ── Fixed action bar ── */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute bottom-0 left-0 right-0 flex-shrink-0"
          style={{
            background: 'rgba(253,253,255,0.97)',
            backdropFilter: 'blur(16px)',
            borderTop: '1px solid rgba(99,102,241,0.07)',
            paddingBottom: 'env(safe-area-inset-bottom, 8px)',
          }}
        >
          {/* Comment input */}
          <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
            <div
              className="flex-1 flex items-center gap-2 px-3.5 rounded-2xl"
              style={{
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.14)',
                height: '38px',
              }}
            >
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendComment()}
                placeholder="写下你的想法…"
                className="flex-1 bg-transparent outline-none"
                style={{ color: '#1E1B4B', fontSize: '13px' }}
              />
              <AnimatePresence>
                {commentText.trim() && (
                  <motion.button
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    onClick={handleSendComment}
                    whileTap={{ scale: 0.88 }}
                  >
                    <Send size={15} style={{ color }} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-around px-4 py-2.5">
            {/* Like */}
            <motion.button
              onClick={handleLike}
              whileTap={{ scale: 0.78 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              className="flex flex-col items-center gap-0.5"
            >
              <motion.div
                animate={liked ? { scale: [1, 1.4, 1], rotate: [0, -15, 0] } : {}}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              >
                <Heart
                  size={24}
                  fill={liked ? '#EF4444' : 'none'}
                  style={{ color: liked ? '#EF4444' : '#9CA3AF' }}
                />
              </motion.div>
              <span style={{ fontSize: '10.5px', color: liked ? '#EF4444' : '#9CA3AF', fontWeight: liked ? 700 : 400 }}>
                {formatLikes(likeCount)}
              </span>
            </motion.button>

            {/* Comment */}
            <motion.button
              onClick={() => setShowComments(v => !v)}
              whileTap={{ scale: 0.82 }}
              className="flex flex-col items-center gap-0.5"
            >
              <MessageCircle
                size={24}
                style={{ color: showComments ? color : '#9CA3AF' }}
                fill={showComments ? `${color}18` : 'none'}
              />
              <span style={{ fontSize: '10.5px', color: showComments ? color : '#9CA3AF', fontWeight: showComments ? 700 : 400 }}>
                {comments.length}
              </span>
            </motion.button>

            {/* Bookmark */}
            <motion.button
              onClick={() => setBookmarked(v => !v)}
              whileTap={{ scale: 0.82 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              className="flex flex-col items-center gap-0.5"
            >
              <motion.div
                animate={bookmarked ? { y: [0, -4, 0] } : {}}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <Bookmark
                  size={24}
                  fill={bookmarked ? color : 'none'}
                  style={{ color: bookmarked ? color : '#9CA3AF' }}
                />
              </motion.div>
              <span style={{ fontSize: '10.5px', color: bookmarked ? color : '#9CA3AF', fontWeight: bookmarked ? 700 : 400 }}>
                收藏
              </span>
            </motion.button>

            {/* Share */}
            <motion.button
              onClick={handleShare}
              whileTap={{ scale: 0.82 }}
              className="flex flex-col items-center gap-0.5"
            >
              <Share2 size={24} style={{ color: '#9CA3AF' }} />
              <span style={{ fontSize: '10.5px', color: '#9CA3AF' }}>分享</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Share toast */}
        <AnimatePresence>
          {showShareToast && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 px-4 py-2 rounded-2xl whitespace-nowrap z-10"
              style={{ background: 'rgba(30,27,75,0.88)', backdropFilter: 'blur(10px)', color: 'white', fontSize: '13px', fontWeight: 600 }}
            >
              链接已复制到剪贴板 🔗
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ── PostGridCard ──────────────────────────────────────────────────────────────
function PostGridCard({ post, index, color, onSelect, layoutId }: {
  post: GridPost;
  index: number;
  color: string;
  onSelect: (post: GridPost, layoutId: string) => void;
  layoutId: string;
}) {
  const [liked, setLiked] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 320, damping: 28 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'white', boxShadow: '0 2px 12px rgba(30,27,75,0.07)' }}
    >
      {/* Image — tap to open detail */}
      <motion.div
        className="relative overflow-hidden cursor-pointer"
        style={{ height: post.tall ? '220px' : '148px' }}
        onClick={() => onSelect(post, layoutId)}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      >
        <motion.img
          layoutId={layoutId}
          src={post.image}
          alt={post.title}
          className="w-full h-full object-cover"
          style={{ display: 'block' }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        />
        {/* Bottom gradient overlay */}
        <div
          className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)' }}
        />
        {/* Title on image */}
        <p
          className="absolute bottom-2 left-2.5 right-2.5 line-clamp-2"
          style={{ color: 'white', fontSize: '12px', fontWeight: 700, lineHeight: 1.4, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
        >
          {post.title}
        </p>
        {/* Tap ripple hint */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(circle at 50% 50%, ${color}22, transparent 70%)` }}
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
        />
      </motion.div>

      {/* Footer */}
      <div className="flex items-center justify-between px-2.5 py-2">
        <div className="flex items-center gap-1" style={{ color: '#9CA3AF' }}>
          <Heart size={12} fill={liked ? color : 'none'} style={{ color: liked ? color : '#9CA3AF' }} />
          <span style={{ fontSize: '11px' }}>{formatLikes(post.likes + (liked ? 1 : 0))}</span>
        </div>
        <motion.button
          onClick={e => { e.stopPropagation(); setLiked(v => !v); }}
          whileTap={{ scale: 0.75 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: liked ? `${color}12` : 'transparent' }}
        >
          <Heart size={13} fill={liked ? color : 'none'} style={{ color: liked ? color : '#D1D5DB' }} />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── UserProfile page ──────────────────────────────────────────────────────────
export function UserProfile() {
  const { id = '1' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('笔记');
  const [followed, setFollowed] = useState(false);
  const [showFollowToast, setShowFollowToast] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{ post: GridPost; layoutId: string } | null>(null);
  const [showDM, setShowDM] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [remoteProfile, setRemoteProfile] = useState<any | null>(null);
  const [remoteGridPosts, setRemoteGridPosts] = useState<GridPost[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const colorList = ['#6366F1', '#8B5CF6', '#3B82F6', '#EC4899', '#10B981', '#F59E0B'];
    const makePlaceholder = (seed: string, base: string) => {
      const c1 = base;
      const c2 = colorList[seed.length % colorList.length];
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    };

    const load = async () => {
      try {
        const [profileRes, postsRes] = await Promise.all([
          api.get(`/social/users/${id}/profile`),
          api.get('/community/posts', { params: { authorId: id, limit: 60, sort: 'latest' } }),
        ]);

        if (cancelled) return;

        const p = profileRes.data?.data;
        if (profileRes.data?.success && p) {
          const name = p.username || `用户${id}`;
          const avatarColor = colorList[name.length % colorList.length];
          const avatarLetter = name.charAt(0).toUpperCase();

          setRemoteProfile({
            name,
            username: p.username || name,
            avatarColor,
            avatarLetter,
            verified: false,
            bio: '',
            posts: p.counts?.posts ?? 0,
            following: p.counts?.following ?? 0,
            followers: String(p.counts?.followers ?? 0),
            coverGradient: `linear-gradient(135deg, ${avatarColor} 0%, #8B5CF6 55%, #3B82F6 100%)`,
            tags: [],
          });

          setFollowed(Boolean(p.relations?.isFollowed));
        }

        const list = postsRes.data?.data?.posts || [];
        if (postsRes.data?.success && Array.isArray(list)) {
          const mapped: GridPost[] = list.map((row: any, idx: number) => {
            const title = String(row.title || '').trim() || String(row.summary || '').trim().slice(0, 18) || '未命名';
            const body = String(row.summary || '').replace(/\s+/g, ' ').trim();
            const created = row.createdAt ? new Date(row.createdAt) : new Date();
            const mmdd = `${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
            const img = row.coverImage ? String(row.coverImage) : makePlaceholder(String(row.id), (remoteProfile?.avatarColor || '#6366F1'));

            return {
              id: String(row.id),
              title,
              image: img,
              likes: row.likes || 0,
              tall: idx % 3 === 0,
              body,
              date: mmdd,
              readTime: '1分钟',
            };
          });
          setRemoteGridPosts(mapped);
        } else {
          setRemoteGridPosts([]);
        }
      } catch (e) {
        if (!cancelled) {
          setRemoteProfile(null);
          setRemoteGridPosts(null);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id]);

  const profile = remoteProfile ?? USER_PROFILES[id] ?? USER_PROFILES['1'];
  const gridPosts = remoteGridPosts ?? GRID_POSTS[id] ?? GRID_POSTS['1'];
  const leftPosts = useMemo(() => gridPosts.filter((_, i) => i % 2 === 0), [gridPosts]);
  const rightPosts = useMemo(() => gridPosts.filter((_, i) => i % 2 === 1), [gridPosts]);

  const handleFollow = async () => {
    try {
      if (followed) {
        await api.delete('/social/follow', { data: { followingId: id } });
        setFollowed(false);
        if (remoteProfile) {
          setRemoteProfile((prev: any) => prev ? ({ ...prev, followers: String(Math.max(0, parseInt(prev.followers || '0', 10) - 1)) }) : prev);
        }
      } else {
        await api.post('/social/follow', { followingId: id });
        setFollowed(true);
        if (remoteProfile) {
          setRemoteProfile((prev: any) => prev ? ({ ...prev, followers: String(parseInt(prev.followers || '0', 10) + 1) }) : prev);
        }
      }
      setShowFollowToast(true);
      setTimeout(() => setShowFollowToast(false), 2000);
    } catch (e) {
      setShowFollowToast(false);
    }
  };

  const handleSelectPost = (post: GridPost, layoutId: string) => {
    setSelectedPost({ post, layoutId });
  };

  return (
    <div
      className="relative min-h-screen w-full"
      style={{ background: 'linear-gradient(160deg, #FDFDFF 0%, #F8F5FF 50%, #F3F8FF 100%)' }}
    >
      <ParticleBackground />

      {/* ── Content scroll container ── */}
      <div ref={scrollRef} className="relative z-10 h-screen overflow-y-auto" style={{ paddingBottom: '80px' }}>

        {/* ── Sticky top bar ── */}
        <div
          className="sticky top-0 z-30 flex items-center justify-between px-4"
          style={{
            height: '52px',
            background: 'rgba(253,253,255,0.85)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(99,102,241,0.07)',
          }}
        >
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.08)' }}
          >
            <ArrowLeft size={18} style={{ color: '#6366F1' }} />
          </motion.button>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ color: '#1E1B4B', fontSize: '15px', fontWeight: 800 }}
          >
            {profile.name}
          </motion.p>
          <motion.button
            whileTap={{ scale: 0.88 }}
            className="w-9 h-9 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.08)' }}
          >
            <MoreHorizontal size={18} style={{ color: '#6366F1' }} />
          </motion.button>
        </div>

        {/* ── Cover banner ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full relative overflow-hidden"
          style={{ height: '168px', background: profile.coverGradient }}
        >
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20"
            style={{ background: 'rgba(255,255,255,0.4)' }} />
          <div className="absolute top-8 -left-6 w-24 h-24 rounded-full opacity-15"
            style={{ background: 'rgba(255,255,255,0.35)' }} />
          <div className="absolute bottom-4 right-16 w-16 h-16 rounded-full opacity-10"
            style={{ background: 'rgba(255,255,255,0.5)' }} />
        </motion.div>

        {/* ── Profile section ── */}
        <div className="px-4 relative" style={{ marginTop: '-40px' }}>
          <div className="flex items-end justify-between">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 360, damping: 22, delay: 0.12 }}
              className="relative"
            >
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{
                  background: `${profile.avatarColor}22`,
                  border: '4px solid white',
                  boxShadow: `0 6px 24px ${profile.avatarColor}35`,
                }}
              >
                <span style={{ color: profile.avatarColor, fontSize: '28px', fontWeight: 900 }}>
                  {profile.avatarLetter}
                </span>
              </div>
              {profile.verified && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 500 }}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: profile.avatarColor, border: '2px solid white' }}
                >
                  <Check size={11} color="white" strokeWidth={3} />
                </motion.div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18 }}
              className="flex items-center gap-2 pb-1"
            >
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowDM(true)}
                className="px-4 py-2 rounded-2xl"
                style={{
                  background: 'rgba(99,102,241,0.08)',
                  color: '#6366F1',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: '1.5px solid rgba(99,102,241,0.2)',
                }}
              >
                <MessageCircle size={14} className="inline mr-1 -mt-0.5" />
                私信
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleFollow}
                className="px-5 py-2 rounded-2xl transition-all"
                style={followed
                  ? {
                    background: 'rgba(99,102,241,0.08)',
                    color: '#6366F1',
                    fontSize: '13px',
                    fontWeight: 700,
                    border: '1.5px solid rgba(99,102,241,0.3)',
                  }
                  : {
                    background: `linear-gradient(135deg, ${profile.avatarColor}, ${profile.avatarColor}CC)`,
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 700,
                    boxShadow: `0 4px 14px ${profile.avatarColor}45`,
                  }
                }
              >
                {followed ? '已关注 ✓' : '+ 关注'}
              </motion.button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-3"
          >
            <h1 style={{ color: '#1E1B4B', fontSize: '20px', fontWeight: 900 }}>{profile.name}</h1>
            <p style={{ color: '#9CA3AF', fontSize: '13px', marginTop: '2px' }}>@{profile.username}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex gap-7 mt-3.5"
          >
            {[
              { label: '笔记', value: profile.posts },
              { label: '关注', value: profile.following },
              { label: '粉丝', value: profile.followers },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
              >
                <p style={{ color: '#1E1B4B', fontSize: '18px', fontWeight: 800 }}>{s.value}</p>
                <p style={{ color: '#9CA3AF', fontSize: '11.5px', marginTop: '1px' }}>{s.label}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-3.5 whitespace-pre-line"
            style={{ color: '#4B5563', fontSize: '13.5px', lineHeight: 1.7 }}
          >
            {profile.bio}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34 }}
            className="flex flex-wrap gap-2 mt-3 pb-1"
          >
            {profile.tags.map(tag => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full"
                style={{
                  background: `${profile.avatarColor}10`,
                  color: profile.avatarColor,
                  fontSize: '11.5px',
                  fontWeight: 700,
                  border: `1px solid ${profile.avatarColor}20`,
                }}
              >
                #{tag}
              </span>
            ))}
          </motion.div>
        </div>

        {/* ── Tab bar ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.38 }}
          className="sticky z-20 flex mt-4 px-4"
          style={{
            top: '52px',
            background: 'rgba(253,253,255,0.92)',
            backdropFilter: 'blur(14px)',
            borderBottom: '1px solid rgba(99,102,241,0.07)',
          }}
        >
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 relative py-3 flex items-center justify-center"
            >
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: activeTab === tab ? 800 : 500,
                  color: activeTab === tab ? profile.avatarColor : '#9CA3AF',
                  transition: 'all 0.2s',
                }}
              >
                {tab}
              </span>
              {activeTab === tab && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                  style={{ background: profile.avatarColor }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </motion.div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
          {activeTab === '笔记' && (
            <motion.div
              key="notes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex gap-2.5 px-3 pt-3">
                <div className="flex-1 flex flex-col gap-2.5">
                  {leftPosts.map((post, i) => (
                    <PostGridCard
                      key={post.id}
                      post={post}
                      index={i * 2}
                      color={profile.avatarColor}
                      onSelect={handleSelectPost}
                      layoutId={`post-img-${id}-${post.id}`}
                    />
                  ))}
                </div>
                <div className="flex-1 flex flex-col gap-2.5 mt-4">
                  {rightPosts.map((post, i) => (
                    <PostGridCard
                      key={post.id}
                      post={post}
                      index={i * 2 + 1}
                      color={profile.avatarColor}
                      onSelect={handleSelectPost}
                      layoutId={`post-img-${id}-${post.id}`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab !== '笔记' && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 px-8 text-center"
            >
              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                style={{ background: `${profile.avatarColor}10` }}
              >
                <span style={{ fontSize: '28px' }}>{activeTab === '喜欢' ? '🤍' : '🔖'}</span>
              </div>
              <p style={{ color: '#1E1B4B', fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
                暂无{activeTab}内容
              </p>
              <p style={{ color: '#9CA3AF', fontSize: '13px', lineHeight: 1.6 }}>
                {activeTab === '喜欢' ? 'TA 还没有喜欢过任何内容' : 'TA 还没有收藏任何内容'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Post detail sheet ── */}
      <AnimatePresence>
        {selectedPost && (
          <PostDetailSheet
            key={selectedPost.layoutId}
            post={selectedPost.post}
            layoutId={selectedPost.layoutId}
            color={profile.avatarColor}
            profile={profile}
            onClose={() => setSelectedPost(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Direct message sheet ── */}
      <AnimatePresence>
        {showDM && (
          <DirectMessageSheet
            key={`dm-${id}`}
            userId={id}
            userName={profile.name}
            userColor={profile.avatarColor}
            userLetter={profile.avatarLetter}
            onClose={() => setShowDM(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Follow toast ── */}
      <AnimatePresence>
        {showFollowToast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl"
            style={{
              background: 'rgba(30,27,75,0.88)',
              backdropFilter: 'blur(12px)',
              color: 'white',
              fontSize: '13.5px',
              fontWeight: 700,
              boxShadow: '0 8px 28px rgba(30,27,75,0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            {followed ? `已关注 @${profile.username} ✓` : '已取消关注'}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
