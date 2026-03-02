import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Crown, Check, X, ChevronLeft,
  CreditCard, Smartphone, MessageCircle,
} from 'lucide-react';

type BillingCycle = 'monthly' | 'yearly';
type PlanStep = 'plans' | 'payment' | 'processing' | 'success';
type PlanId = 'pro' | 'team';

const PLANS = [
  {
    id: 'pro' as PlanId,
    name: 'Pro 专业版',
    monthlyPrice: 28,
    yearlyPrice: 19,
    yearlyTotal: 228,
    color: '#6366F1',
    gradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
    lightBg: 'rgba(99,102,241,0.06)',
    activeBorder: 'rgba(99,102,241,0.4)',
    shadowColor: 'rgba(99,102,241,0.22)',
    badge: '推荐',
    features: ['无限 AI 调用', '多模型切换', '高级知识图谱', '思圈认证标识', '无限标签', '优先响应'],
  },
  {
    id: 'team' as PlanId,
    name: '团队协作版',
    monthlyPrice: 68,
    yearlyPrice: 48,
    yearlyTotal: 576,
    color: '#0EA5E9',
    gradient: 'linear-gradient(135deg, #0EA5E9, #6366F1)',
    lightBg: 'rgba(14,165,233,0.06)',
    activeBorder: 'rgba(14,165,233,0.4)',
    shadowColor: 'rgba(14,165,233,0.22)',
    badge: '企业',
    features: ['Pro 全部功能', '团队协作空间', '管理员控制台', '优先客服支持', 'API 访问权限', '自定义品牌'],
  },
];

const PAYMENT_METHODS = [
  { id: 'wechat', name: '微信支付', sub: '推荐使用', color: '#07C160', Icon: MessageCircle },
  { id: 'alipay', name: '支付宝', sub: '快捷支付', color: '#1677FF', Icon: Smartphone },
  { id: 'card', name: '银行卡', sub: 'Visa / Mastercard', color: '#6366F1', Icon: CreditCard },
];

const CONFETTI = Array.from({ length: 44 }, (_, i) => ({
  id: i,
  color: ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#F97316', '#EF4444'][i % 8],
  left: `${((i * 9.73 + 3.5) % 92) + 4}%`,
  delay: (i * 0.05) % 1.3,
  duration: 1.4 + (i % 7) * 0.23,
  size: [8, 5, 10, 7, 9][i % 5],
  isCircle: i % 3 === 0,
  rotate: (i * 53) % 360,
}));

// ── Shimmer overlay ──────────────────────────────────────────────────
function Shimmer() {
  return (
    <motion.div
      animate={{ x: ['-100%', '220%'] }}
      transition={{ duration: 2, repeat: Infinity, repeatDelay: 2.8, ease: 'easeInOut' }}
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)',
      }}
    />
  );
}

// ── Plans Step ────────────────────────────────────────────────────────
function PlansStep({
  billing, setBilling, selectedPlan, setSelectedPlan, onNext, onClose,
}: {
  billing: BillingCycle;
  setBilling: (b: BillingCycle) => void;
  selectedPlan: PlanId;
  setSelectedPlan: (id: PlanId) => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const activePlan = PLANS.find(p => p.id === selectedPlan)!;

  return (
    <motion.div
      key="plans"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
      style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
    >
      {/* Fixed header */}
      <div className="flex-shrink-0">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(0,0,0,0.12)' }} />
        </div>

        <div className="flex items-start justify-between px-5 pt-3 pb-3">
          <div>
            <p style={{ color: '#1E1B4B', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em' }}>
              选择套餐
            </p>
            <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '3px' }}>
              解锁 Hi Brain 的全部潜力
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(99,102,241,0.08)' }}
          >
            <X size={16} style={{ color: '#6366F1' }} />
          </button>
        </div>

        {/* Billing toggle */}
        <div className="mx-4 mb-4 p-1 rounded-2xl flex" style={{ background: 'rgba(0,0,0,0.05)' }}>
          {(['monthly', 'yearly'] as BillingCycle[]).map(cycle => (
            <motion.button
              key={cycle}
              onClick={() => setBilling(cycle)}
              className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-1.5 relative"
              animate={{ background: billing === cycle ? 'white' : 'transparent' }}
              transition={{ duration: 0.2 }}
              style={{ boxShadow: billing === cycle ? '0 2px 8px rgba(0,0,0,0.09)' : 'none' }}
            >
              <span style={{
                color: billing === cycle ? '#1E1B4B' : '#9CA3AF',
                fontSize: '13px',
                fontWeight: billing === cycle ? 700 : 500,
                transition: 'color 0.2s',
              }}>
                {cycle === 'monthly' ? '按月付费' : '按年付费'}
              </span>
              {cycle === 'yearly' && (
                <motion.span
                  animate={{
                    background: billing === 'yearly'
                      ? 'linear-gradient(135deg, #10B981, #059669)'
                      : 'rgba(16,185,129,0.15)',
                  }}
                  className="px-1.5 py-0.5 rounded-full"
                  style={{
                    color: billing === 'yearly' ? 'white' : '#10B981',
                    fontSize: '9px', fontWeight: 800,
                  }}
                >
                  省38%
                </motion.span>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Scrollable cards */}
      <div
        className="flex-1 overflow-y-auto min-h-0 px-4 space-y-3 pb-2"
        style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
      >
        {/* Current plan indicator */}
        <div
          className="flex items-center gap-3 p-3.5 rounded-2xl"
          style={{ background: 'rgba(0,0,0,0.03)', border: '1.5px dashed rgba(0,0,0,0.08)' }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,0,0,0.06)' }}>
            <Crown size={16} style={{ color: '#9CA3AF' }} />
          </div>
          <div className="flex-1">
            <p style={{ color: '#6B7280', fontSize: '13px', fontWeight: 600 }}>当前套餐：免费版</p>
            <p style={{ color: '#9CA3AF', fontSize: '11px' }}>100次/月 AI · 基础功能</p>
          </div>
          <span className="px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.06)', color: '#9CA3AF', fontSize: '10px', fontWeight: 600 }}>
            使用中
          </span>
        </div>

        {/* Plan cards */}
        {PLANS.map(plan => {
          const isSelected = selectedPlan === plan.id;
          const price = billing === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;

          return (
            <motion.button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              whileTap={{ scale: 0.985 }}
              animate={{
                scale: isSelected ? 1.015 : 1,
                boxShadow: isSelected ? `0 6px 24px ${plan.shadowColor}` : '0 0px 0px transparent',
              }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              className="w-full rounded-2xl p-4 text-left relative overflow-hidden"
              style={{
                background: isSelected ? plan.lightBg : 'rgba(0,0,0,0.02)',
                border: isSelected ? `1.5px solid ${plan.activeBorder}` : '1.5px solid rgba(0,0,0,0.05)',
              }}
            >
              {/* Top row: icon + name + price */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <motion.div
                    animate={{ background: isSelected ? plan.gradient : `${plan.color}18` }}
                    transition={{ duration: 0.25 }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  >
                    <Crown size={18} color={isSelected ? 'white' : plan.color} />
                  </motion.div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p style={{ color: '#1E1B4B', fontSize: '15px', fontWeight: 800 }}>{plan.name}</p>
                      <motion.span
                        animate={{
                          background: isSelected ? plan.gradient : `${plan.color}18`,
                          color: isSelected ? 'white' : plan.color,
                        }}
                        transition={{ duration: 0.25 }}
                        className="px-2 py-0.5 rounded-full"
                        style={{ fontSize: '9px', fontWeight: 800 }}
                      >
                        {plan.badge}
                      </motion.span>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="flex items-baseline gap-0.5 justify-end">
                    <span style={{ color: plan.color, fontSize: '10px', fontWeight: 700 }}>¥</span>
                    <span style={{ color: plan.color, fontSize: '26px', fontWeight: 900, lineHeight: 1 }}>
                      {price}
                    </span>
                    <span style={{ color: '#9CA3AF', fontSize: '11px' }}>/月</span>
                  </div>
                  {billing === 'yearly' && (
                    <p style={{ color: '#9CA3AF', fontSize: '10px', textDecoration: 'line-through', textAlign: 'right' }}>
                      ¥{plan.monthlyPrice}/月
                    </p>
                  )}
                </div>
              </div>

              {/* Features grid */}
              <div className="grid grid-cols-2 gap-1.5">
                {plan.features.map(f => (
                  <div key={f} className="flex items-center gap-1.5">
                    <motion.div
                      animate={{ background: isSelected ? plan.gradient : `${plan.color}15` }}
                      transition={{ duration: 0.25 }}
                      className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
                    >
                      <Check size={8} color={isSelected ? 'white' : plan.color} />
                    </motion.div>
                    <span style={{ color: '#6B7280', fontSize: '11px' }}>{f}</span>
                  </div>
                ))}
              </div>

              {/* Selection glow overlay */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                      position: 'absolute', inset: 0, borderRadius: '16px', pointerEvents: 'none',
                      background: `radial-gradient(ellipse at top right, ${plan.color}0A, transparent 70%)`,
                    }}
                  />
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}

        <div className="h-2" />
      </div>

      {/* Fixed CTA */}
      <div
        className="flex-shrink-0 px-4 pb-8 pt-3"
        style={{ borderTop: '1px solid rgba(0,0,0,0.05)', background: 'rgba(253,253,255,0.98)', backdropFilter: 'blur(12px)' }}
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onNext}
          className="w-full py-4 rounded-2xl text-center relative overflow-hidden"
          style={{
            background: activePlan.gradient,
            color: 'white', fontSize: '15px', fontWeight: 800,
            boxShadow: `0 6px 22px ${activePlan.shadowColor}`,
          }}
        >
          继续选择支付方式
          <Shimmer />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Payment Step ──────────────────────────────────────────────────────
function PaymentStep({
  plan, billing, selectedPayment, setSelectedPayment, onNext, onBack,
}: {
  plan: typeof PLANS[0];
  billing: BillingCycle;
  selectedPayment: string;
  setSelectedPayment: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const price = billing === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
  const totalCharge = billing === 'yearly' ? plan.yearlyTotal : plan.monthlyPrice;

  return (
    <motion.div
      key="payment"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', damping: 26, stiffness: 260 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.08)' }}
        >
          <ChevronLeft size={18} style={{ color: '#6366F1' }} />
        </motion.button>
        <div>
          <p style={{ color: '#1E1B4B', fontSize: '18px', fontWeight: 800 }}>选择支付方式</p>
        </div>
      </div>

      {/* Plan summary card */}
      <div
        className="mx-4 mb-5 p-4 rounded-2xl"
        style={{ background: plan.lightBg, border: `1.5px solid ${plan.activeBorder}` }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p style={{ color: plan.color, fontSize: '13px', fontWeight: 700 }}>{plan.name}</p>
            <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '2px' }}>
              {billing === 'yearly' ? '年付套餐 · 到期自动续费' : '月付套餐 · 到期自动续费'}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-baseline gap-0.5 justify-end">
              <span style={{ color: plan.color, fontSize: '9px', fontWeight: 700 }}>¥</span>
              <span style={{ color: plan.color, fontSize: '24px', fontWeight: 900, lineHeight: 1 }}>{price}</span>
              <span style={{ color: '#9CA3AF', fontSize: '11px' }}>/月</span>
            </div>
          </div>
        </div>
        {billing === 'yearly' && (
          <div className="mt-2 pt-2.5" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <p style={{ color: '#10B981', fontSize: '11px', fontWeight: 600 }}>
              年付立省 ¥{plan.monthlyPrice * 12 - plan.yearlyTotal} · 今日扣款 ¥{plan.yearlyTotal}
            </p>
          </div>
        )}
      </div>

      {/* Payment methods */}
      <div className="px-4 space-y-2.5 mb-6">
        {PAYMENT_METHODS.map(method => {
          const isSel = selectedPayment === method.id;
          return (
            <motion.button
              key={method.id}
              onClick={() => setSelectedPayment(method.id)}
              whileTap={{ scale: 0.98 }}
              className="w-full p-4 rounded-2xl flex items-center gap-3"
              animate={{
                background: isSel ? `${method.color}0D` : 'rgba(0,0,0,0.02)',
                borderColor: isSel ? `${method.color}55` : 'transparent',
              }}
              style={{ border: '1.5px solid transparent' }}
              transition={{ duration: 0.18 }}
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${method.color}15` }}
              >
                <method.Icon size={20} style={{ color: method.color }} />
              </div>
              <div className="flex-1 text-left">
                <p style={{ color: '#1E1B4B', fontSize: '14px', fontWeight: 700 }}>{method.name}</p>
                <p style={{ color: '#9CA3AF', fontSize: '12px' }}>{method.sub}</p>
              </div>
              <motion.div
                animate={{ background: isSel ? method.color : 'rgba(0,0,0,0.08)' }}
                transition={{ duration: 0.18 }}
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              >
                {isSel && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}>
                    <Check size={11} color="white" />
                  </motion.div>
                )}
              </motion.div>
            </motion.button>
          );
        })}
      </div>

      {/* Confirm button */}
      <div className="px-4 pb-10">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onNext}
          className="w-full py-4 rounded-2xl text-center relative overflow-hidden"
          style={{
            background: plan.gradient, color: 'white',
            fontSize: '15px', fontWeight: 800,
            boxShadow: `0 6px 22px ${plan.shadowColor}`,
          }}
        >
          确认支付 ¥{totalCharge}{billing === 'yearly' ? '（年付）' : ''}
          <Shimmer />
        </motion.button>
        <p className="text-center mt-3" style={{ color: '#9CA3AF', fontSize: '11px' }}>
          通过银行级 SSL 加密保护 · 随时可取消
        </p>
      </div>
    </motion.div>
  );
}

// ── Processing Step ────────────────────────────────────────────────────
function ProcessingStep() {
  return (
    <motion.div
      key="processing"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-20 px-8"
    >
      {/* Pulsing rings + crown */}
      <div className="relative w-24 h-24 flex items-center justify-center mb-8">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full"
            animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.55, ease: 'easeOut' }}
            style={{ background: 'rgba(99,102,241,0.22)' }}
          />
        ))}
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, rgba(99,102,241,0) 0%, rgba(99,102,241,0.6) 50%, rgba(99,102,241,0) 100%)',
          }}
        />
        <div
          className="relative w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            boxShadow: '0 8px 32px rgba(99,102,241,0.45)',
          }}
        >
          <Crown size={32} color="white" />
        </div>
      </div>

      <p style={{ color: '#1E1B4B', fontSize: '20px', fontWeight: 800 }}>支付处理中</p>
      <p style={{ color: '#9CA3AF', fontSize: '13px', marginTop: '6px' }}>安全加密通道 · 请稍候</p>

      {/* Animated dots */}
      <div className="flex gap-2 mt-8">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="rounded-full"
            style={{ width: '8px', height: '8px', background: '#6366F1' }}
            animate={{ scale: [1, 1.6, 1], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.35 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Success Step ────────────────────────────────────────────────────────
function SuccessStep({
  planName, gradient, onClose,
}: { planName: string; gradient: string; onClose: () => void }) {
  const expiry = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  })();

  return (
    <motion.div
      key="success"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative overflow-hidden"
      style={{ minHeight: '480px' }}
    >
      {/* Confetti burst */}
      {CONFETTI.map(c => (
        <motion.div
          key={c.id}
          initial={{ y: 0, opacity: 1, rotate: c.rotate }}
          animate={{ y: 520, opacity: [1, 1, 0], rotate: c.rotate + 400 }}
          transition={{ duration: c.duration, delay: c.delay, ease: [0.25, 0.46, 0.45, 0.94] }}
          style={{
            position: 'absolute',
            left: c.left,
            top: '60px',
            width: c.size,
            height: c.isCircle ? c.size : c.size * 1.6,
            borderRadius: c.isCircle ? '50%' : '2px',
            background: c.color,
            zIndex: 0,
          }}
        />
      ))}

      <div className="relative z-10 flex flex-col items-center pt-12 pb-10 px-6">
        {/* Animated checkmark */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 250, damping: 17, delay: 0.15 }}
          className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
          style={{
            background: 'linear-gradient(135deg, #10B981, #059669)',
            boxShadow: '0 12px 40px rgba(16,185,129,0.4)',
          }}
        >
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 400 }}
          >
            <Check size={44} color="white" strokeWidth={3} />
          </motion.div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          style={{ color: '#1E1B4B', fontSize: '28px', fontWeight: 900, letterSpacing: '-0.02em' }}
        >
          订阅成功！
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.52, type: 'spring', stiffness: 300 }}
          className="mt-2 px-4 py-1.5 rounded-full"
          style={{ background: gradient }}
        >
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 700 }}>{planName} 已激活</span>
        </motion.div>

        {/* Plan details */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mt-7 w-full rounded-2xl p-4"
          style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}
        >
          {[
            { label: '套餐', value: planName },
            { label: '有效期至', value: expiry },
            { label: '状态', value: '已激活', color: '#10B981' },
          ].map((row, i) => (
            <div key={row.label} className={`flex justify-between items-center${i > 0 ? ' mt-2.5' : ''}`}>
              <span style={{ color: '#9CA3AF', fontSize: '12px' }}>{row.label}</span>
              <span style={{ color: row.color ?? '#1E1B4B', fontSize: '13px', fontWeight: 700 }}>
                {row.color ? '● ' : ''}{row.value}
              </span>
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.82 }}
          whileTap={{ scale: 0.97 }}
          onClick={onClose}
          className="w-full mt-6 py-4 rounded-2xl text-center relative overflow-hidden"
          style={{
            background: gradient, color: 'white',
            fontSize: '15px', fontWeight: 800,
            boxShadow: '0 6px 22px rgba(99,102,241,0.35)',
          }}
        >
          立即体验会员功能
          <Shimmer />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ── Subscription Panel (bottom sheet) ─────────────────────────────────
function SubscriptionPanel({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<PlanStep>('plans');
  const [billing, setBilling] = useState<BillingCycle>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('pro');
  const [selectedPayment, setSelectedPayment] = useState('wechat');

  const plan = PLANS.find(p => p.id === selectedPlan)!;

  useEffect(() => {
    if (step === 'processing') {
      const t = setTimeout(() => setStep('success'), 2200);
      return () => clearTimeout(t);
    }
  }, [step]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end"
      style={{ background: 'rgba(20,17,60,0.55)', backdropFilter: 'blur(10px)' }}
      onClick={step !== 'processing' && step !== 'success' ? onClose : undefined}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 240 }}
        className="w-full max-w-lg rounded-t-3xl"
        style={{
          background: '#FDFDFF',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <AnimatePresence mode="wait">
          {step === 'plans' && (
            <PlansStep
              key="plans"
              billing={billing}
              setBilling={setBilling}
              selectedPlan={selectedPlan}
              setSelectedPlan={setSelectedPlan}
              onNext={() => setStep('payment')}
              onClose={onClose}
            />
          )}
          {step === 'payment' && (
            <PaymentStep
              key="payment"
              plan={plan}
              billing={billing}
              selectedPayment={selectedPayment}
              setSelectedPayment={setSelectedPayment}
              onNext={() => setStep('processing')}
              onBack={() => setStep('plans')}
            />
          )}
          {step === 'processing' && <ProcessingStep key="processing" />}
          {step === 'success' && (
            <SuccessStep
              key="success"
              planName={plan.name}
              gradient={plan.gradient}
              onClose={onClose}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ── Main Export (replaces the selected <div className="py-4"> block) ───
export function SubscriptionSection() {
  const [showPanel, setShowPanel] = useState(false);

  const aiUsed = 23;
  const aiTotal = 100;
  const usagePct = (aiUsed / aiTotal) * 100;

  return (
    <div className="py-4">
      {/* Plan header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Pulsing crown */}
          <div className="relative w-10 h-10 flex-shrink-0 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.7], opacity: [0.45, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
              className="absolute inset-0 rounded-2xl"
              style={{ background: 'rgba(99,102,241,0.22)' }}
            />
            <div
              className="relative w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.08)' }}
            >
              <Crown size={18} style={{ color: '#6366F1' }} />
            </div>
          </div>
          <div>
            <p style={{ color: '#1E1B4B', fontSize: '14px', fontWeight: 700 }}>免费版</p>
            <p style={{ color: '#9CA3AF', fontSize: '12px' }}>基础功能 · 100次/月 AI</p>
          </div>
        </div>
        <span
          className="px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '11px', fontWeight: 600 }}
        >
          当前套餐
        </span>
      </div>

      {/* Usage bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <p style={{ color: '#6B7280', fontSize: '11px', fontWeight: 600 }}>本月 AI 用量</p>
          <p style={{ color: '#6366F1', fontSize: '11px', fontWeight: 700 }}>{aiUsed} / {aiTotal} 次</p>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.07)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${usagePct}%` }}
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.4 }}
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #6366F1, #8B5CF6)' }}
          />
        </div>
        <p style={{ color: '#9CA3AF', fontSize: '10px', marginTop: '4px' }}>
          剩余 {aiTotal - aiUsed} 次 · 每月 1 日重置
        </p>
      </div>

      {/* Upgrade CTA button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={() => setShowPanel(true)}
        className="w-full py-3 rounded-2xl text-center relative overflow-hidden mb-3"
        style={{
          background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          color: 'white', fontSize: '14px', fontWeight: 700,
          boxShadow: '0 4px 16px rgba(99,102,241,0.32)',
        }}
      >
        <Crown size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
        升级 Pro — 解锁无限可能
        <Shimmer />
      </motion.button>

      {/* Feature chips */}
      <div className="flex gap-1.5 flex-wrap">
        {['∞ 无限AI', '多模型', '知识图谱', '思圈认证'].map(f => (
          <span
            key={f}
            className="px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}
          >
            <Check size={10} style={{ color: '#6366F1' }} />
            <span style={{ color: '#6366F1', fontSize: '11px', fontWeight: 600 }}>{f}</span>
          </span>
        ))}
      </div>

      {/* Portal: renders directly on document.body to escape parent stacking context */}
      {showPanel && createPortal(
        <AnimatePresence>
          <SubscriptionPanel onClose={() => setShowPanel(false)} />
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}