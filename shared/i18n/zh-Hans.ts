/**
 * Simplified Chinese (zh-Hans).
 *
 * ⚠ UNREVIEWED MACHINE TRANSLATION. Not yet checked by anyone who reads
 * Chinese. Per the plan's standing constraints this is demo-grade until a
 * native reviewer signs it off: a mistranslated "terminate lease" is worse
 * than an English button.
 *
 * This catalogue is for ONE CLIENT DEMO and must not reach the live site. The
 * gate is `DEPLOYMENT_LOCALE` (see `enabledLocales`): unset — every production
 * container — serves English alone, so being in the build does not make it
 * reachable.
 *
 * PARTIAL BY DESIGN, FILLED OUTWARD FROM WHAT IS ON SCREEN. A missing key
 * renders English through `translate()`'s fallback, which is a working app
 * rather than a screen of key names — so a half-filled catalogue is safe to
 * ship and safe to grow.
 *
 * PLACEHOLDERS ARE CODE. `{amount}`, `{period}`, `{count}` and friends are
 * substituted by name; translating or reordering the braces breaks the string
 * silently. The words around them move freely — Chinese word order differs —
 * but the tokens themselves are copied verbatim.
 */

import type { Catalogue } from './t';

export const zhHans: Catalogue = {
  // ── Chrome ───────────────────────────────────────────────────────────────
  'locale.label': '语言',
  'locale.change': '更改语言',

  'shell.signOut': '退出登录',
  'shell.openMenu': '打开菜单',
  'shell.closeMenu': '关闭菜单',
  'shell.notifications': '通知',
  'shell.splash.blurb': '{brand} 是面向租赁中介的物业管理平台——租约、租金收缴、信托会计、业主付款与维修。登录以继续进入后台。',
  'shell.impersonating': '您正以 {platform} 支持人员身份查看 {agency}——您操作的是该中介的真实数据。',

  'deployment.onsite_backoffice': '本地部署 · 仅后台',
  'deployment.onsite_connected': '本地部署 · 已联网',
  'deployment.private_server': '专属服务器',

  // ── Navigation ───────────────────────────────────────────────────────────
  'nav.dashboard': '仪表板',
  'nav.properties': '物业',
  'nav.leases': '租约',
  'nav.leaseParsing': '导入租约',
  'nav.payments': '收款',
  'nav.statements': '银行对账单',
  'nav.listings': '房源',
  'nav.applications': '租赁申请',
  'nav.owners': '业主',
  'nav.agents': '经纪人',
  'nav.providers': '服务商',
  'nav.reports': '报表',
  'nav.godsEye': '物业总览图',
  'nav.documents': '文件',
  'nav.inspections': '验房',
  'nav.utilities': '水电费',
  'nav.apiKeys': 'API 密钥',
  'nav.notifications': '通知',
  'nav.messages': '消息',
  'nav.billing': '账单',
  'nav.settings': '设置',

  // ── Shared controls ──────────────────────────────────────────────────────
  'common.cancel': '取消',
  'common.close': '关闭',
  'common.save': '保存',
  'common.none': '—',

  'pager.summary': '共 {count} {noun} · 第 {page} / {pages} 页',
  'pager.previous': '上一页',
  'pager.next': '下一页',
  'pager.noun.rows': '行',

  'ui.back': '返回',
  'ui.confirm': '确认',
  'ui.closeDialog': '关闭对话框',
  'ui.donut.onTime': '准时',

  // ── Portfolio map ────────────────────────────────────────────────────────
  'godsEye.title': '物业总览图',
  'godsEye.subtitle': '查看投资组合中需要关注的部分。点击物业查看其单元。',
  'godsEye.allProperties': '全部物业',
  'godsEye.byProperty': '按物业',
  'godsEye.byPropertyHint': '每根色条代表该物业的单元，按问题类型划分。点击物业查看单元网格。',
  'godsEye.unitsInProperty': '个单元',
  'godsEye.inArrears': '欠租',
  'godsEye.backToPortfolio': '返回全部物业',
  'godsEye.nothingOutstanding': '无未结事项',
  'godsEye.rollupView': '汇总',
  'godsEye.sceneView': '天际线',
  'godsEye.skylineHint': '一次查看全部物业。高度代表单元数量，亮起的窗户代表各单元状态，底部的光代表风险金额。位置对应下方排名，并非地图——点击楼栋查看其单元。',
  'godsEye.mostAtRisk': '风险最高',
  'godsEye.skylineNotDrawn': '另有 {properties} 个物业（{units} 个单元）未绘制。下方汇总已列出全部。',
  'godsEye.skylineNarrow': '天际线需要更宽的屏幕。下方排名顺序相同。',

  // ── Dashboard ────────────────────────────────────────────────────────────
  'dashboard.title': '仪表板',
  'dashboard.subtitle': '投资组合总览——所有数据仅限本中介',
  'dashboard.period': '期间',
  'dashboard.refresh': '刷新',
  'dashboard.runBilling': '生成账单',
  'dashboard.collectedFor': '已收款 · {period}',
  'dashboard.ratePill': '已收 {rate}%',
  'dashboard.ofBilled': '本期应收 {amount}',
  'dashboard.collectionRate': '收缴率',
  'dashboard.onTime': '准时',
  // Chinese does not inflect for number, so both plural forms are identical.
  // They are kept as separate keys because the catalogue's shape must match
  // English, not because the strings differ.
  'dashboard.arrears.one': '欠租 · {count} 位租客',
  'dashboard.arrears.other': '欠租 · {count} 位租客',
  'dashboard.outstandingTotal': '未收总额',
  'dashboard.activeLeases': '生效租约',
  'dashboard.collected': '已收款',
  'dashboard.collectionRateIs': '收缴率 {pct}',
  'dashboard.deltaOnPrevious': '较 {period} {pct}',
  'dashboard.stillOut': '尚欠 {amount}',
  'dashboard.occupancy': '出租率',
  'dashboard.occupiedOf': '{total} 个单元中已租 {occupied} 个',
  'dashboard.expiringSoon': '90 天内到期',
  'dashboard.leasesToRenew': '份租约待续签',
  'dashboard.openJobs': '待处理工单',
  'dashboard.activeLeasesNote': '{count} 份生效租约',
  'dashboard.worstFirst': '最紧急优先',
  'dashboard.allLeases': '全部 {count} 份租约',
  'dashboard.outstandingByAge': '未收款账龄',
  'dashboard.reconcilesTo': '对账金额 {amount}',
  'dashboard.rentRoll': '租金明细表',
  'dashboard.th.unit': '单元',
  'dashboard.th.tenant': '租客',
  'dashboard.th.rent': '租金',
  'dashboard.th.status': '状态',
  'dashboard.th.outstanding': '未收款',
  'dashboard.noLeases': '暂无生效租约。',
  'dashboard.aging.notYetDue': '未到期',
  'dashboard.aging.0-30': '0–30',
  'dashboard.aging.31-60': '31–60',
  'dashboard.aging.61-90': '61–90',
  'dashboard.aging.90plus': '90+',
  'dashboard.status.active': '生效中',

  // ── Recording a payment by hand (sealed mode) ────────────────────────────
  'payment.record': '登记收款',
  'payment.recordFor': '登记收款 · {unit}',
  'payment.invoice': '账单',
  'payment.noOutstanding': '该租约没有未结账单。',
  'payment.invoiceOption': '{period} · 到期 {due} · 未收 {amount}',
  'payment.amount': '收到金额',
  'payment.method': '付款方式',
  'payment.method.cash': '现金',
  'payment.method.eft': '电子转账',
  'payment.reference': '凭证号',
  'payment.referenceHint': '现金请填收据号，转账请填银行参考号。',
  'payment.receivedOn': '收款日期',
  'payment.confirm': '确认登记',
  'payment.recorded': '已登记 {period} 的收款。',
  'payment.cashWarning': '现金仅凭登记人确认入账——在存入银行之前不会出现在银行对账单上。',
};
