import { useState } from 'react'
import './App.css'

/* ===== SVG 線條圖示（無 Emoji） ===== */
const SvgIcon = ({ size = 16, children, className = '' }) => (
  <svg
    className={`icon ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

const IconWallet = (p) => (
  <SvgIcon {...p}>
    <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
    <polyline points="16 5 16 7 8 7 8 5" />
    <path d="M16 13h.01" />
  </SvgIcon>
)

const IconFile = (p) => (
  <SvgIcon {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </SvgIcon>
)

const IconInbox = (p) => (
  <SvgIcon {...p}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </SvgIcon>
)

const IconUsers = (p) => (
  <SvgIcon {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </SvgIcon>
)

const IconShield = (p) => (
  <SvgIcon {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </SvgIcon>
)

const IconUpload = (p) => (
  <SvgIcon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </SvgIcon>
)

const IconCheck = (p) => (
  <SvgIcon {...p}>
    <polyline points="20 6 9 17 4 12" />
  </SvgIcon>
)

const IconClose = (p) => (
  <SvgIcon {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </SvgIcon>
)

const IconArrow = (p) => (
  <SvgIcon {...p}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </SvgIcon>
)

const IconDollar = (p) => (
  <SvgIcon {...p}>
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </SvgIcon>
)

const IconHistory = (p) => (
  <SvgIcon {...p}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </SvgIcon>
)

/* ===== 靜態資料 ===== */
const STEPS = [
  { id: 1, label: '申請內容' },
  { id: 2, label: '上載單據' },
  { id: 3, label: '審批分流' },
  { id: 4, label: '覆核遞交' },
]

const EXPENSE_CATEGORIES = ['交通費', '辦公雜費', '餐飲應酬', '緊急採購']

/* 測試帳號（登入切換用） */
const TEST_ACCOUNTS = [
  {
    id: 't1',
    name: 'Testing1',
    initials: 'T1',
    dept: 'Operations',
    accessLevel: 1,
    roleLabel: 'Tier 1 Staff',
    isLevel1: false,
    isLevel2: false,
    desc: '普通申請人：可填寫報銷單並追蹤審批狀態',
  },
  {
    id: 't2',
    name: 'Testing2',
    initials: 'T2',
    dept: 'Operations',
    accessLevel: 2,
    roleLabel: 'Tier 2 Manager',
    isLevel1: true,
    isLevel2: false,
    desc: '第 1 層審批人：可審批待部門主管審批的單據',
  },
  {
    id: 't3',
    name: 'Testing3',
    initials: 'T3',
    dept: 'Finance & Admin',
    accessLevel: 3,
    roleLabel: 'Tier 3 Finance',
    isLevel1: false,
    isLevel2: true,
    desc: '第 2 層審批人：可審批待財務審批的單據及管理權限',
  },
]

/* 權限層級描述 */
const LEVEL_CONFIG = {
  1: { label: 'Level 1', role: '普通申請人', sub: 'Applicant' },
  2: { label: 'Level 2', role: '審批人', sub: 'Approver' },
  3: { label: 'Level 3', role: '系統管理員', sub: 'Admin' },
}

/* 登入持久化 key */
const AUTH_STORAGE_KEY = 'csg_auth_user'

const MENU_ITEMS = [
  {
    id: 'new-claim',
    label: '填寫報銷單',
    sub: 'New Claim',
    icon: IconWallet,
    minLevel: 1,
  },
  {
    id: 'my-claims',
    label: '我的申請紀錄',
    sub: 'My Claims',
    icon: IconHistory,
    minLevel: 1,
  },
  {
    id: 'pending',
    label: '待我審批',
    sub: 'Pending Approvals',
    icon: IconInbox,
    minLevel: 2,
  },
  {
    id: 'user-mgmt',
    label: '權限管理',
    sub: 'User & Role Management',
    icon: IconUsers,
    minLevel: 3,
  },
]

/* 單據狀態機（雙層多級審批） */
const STATUS_CONFIG = {
  pending_1st: {
    label: '待部門主管審批',
    en: 'Pending 1st Approval',
    className: 'status-badge--pending-1st',
  },
  pending_2nd: {
    label: '待財務審批',
    en: 'Pending 2nd Approval',
    className: 'status-badge--pending-2nd',
  },
  approved: {
    label: '已完成核准',
    en: 'Fully Approved',
    className: 'status-badge--approved',
  },
  rejected: {
    label: '已駁回',
    en: 'Rejected',
    className: 'status-badge--rejected',
  },
}

/* 預置員工資料（權限管理用） */
const INITIAL_EMPLOYEES = [
  { id: 'emp1', name: 'Testing1', initials: 'T1', dept: 'Operations', accessLevel: 1, isLevel1: false, isLevel2: false },
  { id: 'emp2', name: 'Testing2', initials: 'T2', dept: 'Operations', accessLevel: 2, isLevel1: true, isLevel2: false },
  { id: 'emp3', name: 'Testing3', initials: 'T3', dept: 'Finance & Admin', accessLevel: 3, isLevel1: false, isLevel2: true },
  { id: 'emp4', name: 'Sarah Wong', initials: 'SW', dept: 'Finance', accessLevel: 2, isLevel1: false, isLevel2: true },
  { id: 'emp5', name: 'Michael Chan', initials: 'MC', dept: 'Operations', accessLevel: 2, isLevel1: true, isLevel2: false },
  { id: 'emp6', name: 'Grace Leung', initials: 'GL', dept: 'HR', accessLevel: 1, isLevel1: false, isLevel2: false },
]

/* 預置單據（涵蓋各審批階段） */
const INITIAL_CLAIMS = [
  { id: 'CL-2026-001', applicant: 'Chen Ka Fai', applicantInitials: 'CK', department: 'Operations', category: '交通費', amount: 860, date: '2026-08-14', remark: '客戶會議往返的士費用', status: 'pending_1st' },
  { id: 'CL-2026-002', applicant: 'Lau Pui Yan', applicantInitials: 'LP', department: 'Finance', category: '辦公雜費', amount: 1240, date: '2026-08-15', remark: '辦公室文具及打印耗材', status: 'pending_1st' },
  { id: 'CL-2026-003', applicant: 'Ng Wing Sze', applicantInitials: 'NW', department: 'Operations', category: '餐飲應酬', amount: 3200, date: '2026-08-16', remark: '與供應商聚餐商討合約', status: 'pending_2nd' },
  { id: 'CL-2026-004', applicant: 'Lee Ka Ho', applicantInitials: 'LH', department: 'HR', category: '緊急採購', amount: 6800, date: '2026-08-17', remark: '緊急更換辦公室影印機', status: 'pending_2nd' },
]

function App() {
  /* 登入狀態：從 localStorage 讀取，未登入為 null */
  const [authUserKey, setAuthUserKey] = useState(() => {
    try {
      return localStorage.getItem(AUTH_STORAGE_KEY)
    } catch {
      return null
    }
  })
  const [activeModule, setActiveModule] = useState('new-claim')
  const [currentStep, setCurrentStep] = useState(1)
  const [applicant, setApplicant] = useState('')
  const [department, setDepartment] = useState('')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState('')
  const [remark, setRemark] = useState('')
  const [receipts, setReceipts] = useState([])
  const [claims, setClaims] = useState(INITIAL_CLAIMS)
  const [employees, setEmployees] = useState(INITIAL_EMPLOYEES)
  const [actionMessage, setActionMessage] = useState('')

  const amountNum = parseFloat(amount) || 0
  const currentUser = TEST_ACCOUNTS.find((a) => a.id === authUserKey)
  const currentLevel = currentUser ? LEVEL_CONFIG[currentUser.accessLevel] : null

  /* 動態計算審批路徑（雙層） */
  const approvalRoute = () => {
    if (!amount || amountNum <= 0) return []
    return [
      { id: 'l1', name: '第 1 層：部門主管', code: '1ST', icon: IconUsers },
      { id: 'l2', name: '第 2 層：財務經理', code: '2ND', icon: IconDollar },
    ]
  }

  /* ===== 登入 / 登出 ===== */
  const handleLogin = (key) => {
    setAuthUserKey(key)
    setActiveModule('new-claim')
    setActionMessage('')
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, key)
    } catch {
      /* localStorage 不可用時忽略 */
    }
  }

  const handleLogout = () => {
    setAuthUserKey(null)
    setActiveModule('new-claim')
    setActionMessage('')
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    } catch {
      /* localStorage 不可用時忽略 */
    }
  }

  const handleModuleClick = (item) => {
    setActiveModule(item.id)
    setActionMessage('')
  }

  /* ===== 申請人動作：載入範例 / 清除 / 儲存草稿 / 遞交 ===== */
  const loadExample = () => {
    setApplicant(currentUser.name)
    setDepartment(currentUser.dept)
    setCategory('交通費')
    setAmount('4500')
    setExpenseDate('2026-08-12')
    setRemark('出差拜訪客戶往返之交通費用，共 3 程。')
    setReceipts(['receipt.pdf'])
    setCurrentStep(1)
    setActionMessage('')
  }

  const clearForm = () => {
    setApplicant(currentUser.name)
    setDepartment(currentUser.dept)
    setCategory('')
    setAmount('')
    setExpenseDate('')
    setRemark('')
    setReceipts([])
    setCurrentStep(1)
    setActionMessage('')
  }

  const removeReceipt = (fileName) => {
    setReceipts((prev) => prev.filter((f) => f !== fileName))
  }

  const saveDraft = () => {
    setActionMessage('草稿已儲存（僅做示範，尚未寫入後端）。')
  }

  const submitForm = () => {
    if (!category || !amount || !expenseDate) {
      setActionMessage('請先填寫費用類別、金額與單據日期再遞交申請。')
      return
    }
    const newClaim = {
      id: `CL-2026-${String(claims.length + 5).padStart(3, '0')}`,
      applicant: currentUser.name,
      applicantInitials: currentUser.initials,
      department: currentUser.dept,
      category,
      amount: amountNum,
      date: expenseDate,
      remark,
      status: 'pending_1st',
    }
    setClaims((prev) => [newClaim, ...prev])
    setActionMessage(
      `申請已成功遞交（${newClaim.id}），狀態為「待部門主管審批」。`,
    )
    clearForm()
  }

  /* ===== 多級審批動作 ===== */
  const handleApprove = (id) => {
    const claim = claims.find((c) => c.id === id)
    if (!claim) return
    if (claim.status === 'pending_1st' && currentUser.isLevel1) {
      setClaims((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'pending_2nd' } : c)),
      )
      setActionMessage(`單據 ${id} 已通過第 1 層審批，狀態變更為「待財務審批」。`)
    } else if (claim.status === 'pending_2nd' && currentUser.isLevel2) {
      setClaims((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'approved' } : c)),
      )
      setActionMessage(`單據 ${id} 已完成全部審批，狀態為「已完成核准」。`)
    }
  }

  const handleReject = (id) => {
    setClaims((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'rejected' } : c)),
    )
    setActionMessage(`單據 ${id} 已駁回。`)
  }

  /* ===== 權限管理動作（Level 3） ===== */
  const handleTogglePermission = (empId, tier) => {
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === empId ? { ...emp, [tier]: !emp[tier] } : emp)),
    )
    const emp = employees.find((e) => e.id === empId)
    if (emp) {
      const tierLabel = tier === 'isLevel1' ? '第 1 層審批權限' : '第 2 層審批權限'
      setActionMessage(`${emp.name} 的${tierLabel}已${emp[tier] ? '移除' : '啟用'}。`)
    }
  }

  /* ===== 未登入：顯示 Login 頁面 ===== */
  if (!currentUser) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-card__brand">
            <div className="login-card__logo">CSG</div>
            <h1 className="login-card__title">City Service Group</h1>
            <p className="login-card__subtitle">Executive Workflow Portal</p>
          </div>
          <p className="login-card__intro">請選擇測試帳號登入以使用報銷系統</p>
          <div className="login-accounts">
            {TEST_ACCOUNTS.map((account) => {
              const lvl = LEVEL_CONFIG[account.accessLevel]
              return (
                <button
                  key={account.id}
                  type="button"
                  className="login-account-btn"
                  onClick={() => handleLogin(account.id)}
                >
                  <span className="login-account-btn__avatar">
                    {account.initials}
                  </span>
                  <span className="login-account-btn__body">
                    <span className="login-account-btn__name">{account.name}</span>
                    <span className="login-account-btn__role">{account.roleLabel}</span>
                    <span className="login-account-btn__dept">{account.dept}</span>
                  </span>
                  <span className="login-account-btn__level">{lvl.label}</span>
                </button>
              )
            })}
          </div>
          <p className="login-card__note">Tier 1 Staff · Tier 2 Manager · Tier 3 Finance</p>
        </div>
      </div>
    )
  }

  /* ===== 登入後的檢視資料（依目前使用者權限） ===== */
  const visibleMenu = MENU_ITEMS.filter((item) => item.minLevel <= currentUser.accessLevel)
  const pendingForUser = claims.filter((c) => c.status === 'pending_1st' && currentUser.isLevel1)
  const pending2ndForUser = claims.filter((c) => c.status === 'pending_2nd' && currentUser.isLevel2)
  const visiblePending =
    currentUser.isLevel1 && currentUser.isLevel2
      ? [...pendingForUser, ...pending2ndForUser]
      : currentUser.isLevel1
        ? pendingForUser
        : currentUser.isLevel2
          ? pending2ndForUser
          : []
  const myClaims = claims.filter((c) => c.applicant === currentUser.name)
  const level1Count = employees.filter((e) => e.isLevel1).length
  const level2Count = employees.filter((e) => e.isLevel2).length
  const route = approvalRoute()

  return (
    <div className="pc-shell">
      {/* ===== 左側 Sidebar ===== */}
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__logo">CSG</div>
          <div className="sidebar__brand-text">
            <h1 className="sidebar__title">City Service Group</h1>
            <p className="sidebar__subtitle">Executive Workflow Portal</p>
          </div>
        </div>

        {/* 登入使用者資訊卡 */}
        <div className="user-badge">
          <div className="user-badge__avatar">{currentUser.initials}</div>
          <div className="user-badge__info">
            <span className="user-badge__name">{currentUser.name}</span>
            <span className="user-badge__dept">{currentUser.dept}</span>
          </div>
          <span className="user-badge__level">{currentLevel.label}</span>
        </div>

        {/* 多模組選單 */}
        <nav className="sidebar__nav">
          <p className="sidebar__section-title">MODULES</p>
          {visibleMenu.map((item) => {
            const ItemIcon = item.icon
            const pendingCount = item.id === 'pending' ? visiblePending.length : 0
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${activeModule === item.id ? 'nav-item--active' : ''}`}
                onClick={() => handleModuleClick(item)}
              >
                <ItemIcon size={17} />
                <span className="nav-item__text">
                  <span className="nav-item__label">{item.label}</span>
                  <span className="nav-item__sub">{item.sub}</span>
                </span>
                {pendingCount > 0 && <span className="nav-item__badge">{pendingCount}</span>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar__footer">
          <div className="access-note">
            <IconShield size={16} />
            <p className="access-note__text">
              {currentUser.roleLabel}：{currentUser.desc}
            </p>
          </div>
        </div>
      </aside>

      {/* ===== 主內容區 ===== */}
      <main className="pc-main">
        {/* Topbar：標題 + 登入者資訊 + Logout */}
        <header className="topbar">
          <div className="topbar__title">
            <h2 className="topbar__heading">Petty Cash Reimbursement</h2>
            <p className="topbar__sub">雙層多級審批架構 · Two-Tier Multi-Stage Approval</p>
          </div>
          <div className="auth-bar">
            <div className="auth-bar__user">
              <span className="auth-bar__avatar">{currentUser.initials}</span>
              <div className="auth-bar__info">
                <span className="auth-bar__name">{currentUser.name}</span>
                <span className="auth-bar__role">
                  {currentUser.roleLabel} · {currentLevel.label}
                </span>
              </div>
            </div>
            <button type="button" className="btn-logout" onClick={handleLogout}>
              Logout（登出）
            </button>
          </div>
        </header>

        {/* 目前權限提示條 */}
        <div className="level-strip">
          <span className="level-strip__tag">{currentLevel.label}</span>
          <span className="level-strip__role">{currentUser.name}（{currentUser.roleLabel}）</span>
          <span className="level-strip__desc">{currentUser.desc}</span>
        </div>

        {/* 操作結果提示 */}
        {actionMessage && <div className="action-toast">{actionMessage}</div>}

        {/* ===== 填寫報銷單 ===== */}
        {activeModule === 'new-claim' && (
          <>
            <nav className="stepper" aria-label="申請進度">
              {STEPS.map((step, index) => (
                <div
                  key={step.id}
                  className={`stepper__item ${
                    currentStep === step.id ? 'stepper__item--active' : ''
                  } ${currentStep > step.id ? 'stepper__item--done' : ''}`}
                >
                  <div className="stepper__circle">
                    {currentStep > step.id ? <IconCheck size={16} /> : <span>{step.id}</span>}
                  </div>
                  <span className="stepper__label">Step {step.id}（{step.label}）</span>
                  {index < STEPS.length - 1 && (
                    <span className="stepper__connector" aria-hidden="true" />
                  )}
                </div>
              ))}
            </nav>

            <section className="pc-card">
              <div className="pc-card__header">
                <h2 className="pc-card__title">Petty Cash 報銷申請表</h2>
                <button type="button" className="btn-load" onClick={loadExample}>
                  載入 Petty Cash 範例
                </button>
              </div>

              <div className="pc-form-grid">
                <div className="pc-field">
                  <label htmlFor="applicant">申請人</label>
                  <input
                    id="applicant"
                    type="text"
                    value={applicant}
                    onChange={(e) => setApplicant(e.target.value)}
                    placeholder={currentUser.name}
                  />
                </div>
                <div className="pc-field">
                  <label htmlFor="department">部門</label>
                  <input
                    id="department"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder={currentUser.dept}
                  />
                </div>
                <div className="pc-field">
                  <label htmlFor="category">費用類別</label>
                  <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">請選擇類別</option>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="pc-field">
                  <label htmlFor="amount">報銷總金額（HKD）</label>
                  <div className="pc-input-group">
                    <span className="pc-input-group__prefix">HK$</span>
                    <input
                      id="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      aria-label="報銷總金額（港幣）"
                    />
                  </div>
                </div>
                <div className="pc-field">
                  <label htmlFor="expenseDate">單據日期</label>
                  <input
                    id="expenseDate"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="pc-field pc-field--full">
                <label htmlFor="remark">報銷事由 / 備註</label>
                <textarea
                  id="remark"
                  rows="4"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="請描述報銷事由，例如：出差拜訪客戶的交通費用..."
                />
              </div>

              {/* 單據上載區 */}
              <div className="pc-field pc-field--full">
                <label>單據上載</label>
                <div className="upload-area">
                  <div className="upload-area__inner">
                    <span className="upload-area__icon"><IconUpload size={26} /></span>
                    <p className="upload-area__text">
                      拖曳檔案至此，或 <span className="upload-area__link">瀏覽檔案</span>
                    </p>
                    <p className="upload-area__hint">支援 PDF / JPG / PNG，最多 5MB</p>
                  </div>
                  {receipts.length > 0 && (
                    <ul className="file-list">
                      {receipts.map((file) => (
                        <li key={file} className="file-chip">
                          <span className="file-chip__icon"><IconFile size={16} /></span>
                          <span className="file-chip__name">{file}</span>
                          <button
                            type="button"
                            className="file-chip__remove"
                            onClick={() => removeReceipt(file)}
                            aria-label={`移除 ${file}`}
                          >
                            <IconClose size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            {/* 金額門檻自動分流卡片（雙層） */}
            <section className="routing-card">
              <h2 className="routing-card__title">審批路徑預覽</h2>
              {route.length > 0 ? (
                <>
                  <p className="routing-card__tier">
                    目前金額 HK${amountNum.toLocaleString()}
                    <span className="routing-card__tier-badge">雙層審批</span>
                  </p>
                  <div className="routing-track">
                    {route.map((step) => {
                      const StepIcon = step.icon
                      return (
                        <div key={step.id} className="routing-node">
                          <div className="routing-node__card">
                            <span className="routing-node__icon"><StepIcon size={16} /></span>
                            <span className="routing-node__name">{step.name}</span>
                            <span className="routing-node__code">{step.code}</span>
                          </div>
                          {step.id !== route[route.length - 1].id && (
                            <span className="routing-node__arrow"><IconArrow size={16} /></span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <p className="routing-card__empty">
                  輸入報銷金額以自動預覽雙層審批路徑。
                  <br />
                  <span className="routing-card__rules">
                    所有單據一律經第 1 層部門主管 → 第 2 層財務經理兩層審批
                  </span>
                </p>
              )}
            </section>

            {/* 按鈕列 */}
            <footer className="pc-footer">
              <button type="button" className="btn-save" onClick={saveDraft}>儲存草稿</button>
              <button type="button" className="btn-clear" onClick={clearForm}>清除表單</button>
              <button type="button" className="btn-submit" onClick={submitForm}>下一步 / 遞交申請</button>
            </footer>
          </>
        )}

        {/* ===== 我的申請紀錄 ===== */}
        {activeModule === 'my-claims' && (
          <section className="pc-card">
            <div className="pc-card__header">
              <h2 className="pc-card__title">我的申請紀錄</h2>
            </div>
            {myClaims.length === 0 ? (
              <p className="empty-state">目前沒有已提交的申請紀錄。請先前往「填寫報銷單」遞交申請。</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>單據編號</th>
                    <th>費用類別</th>
                    <th>金額 (HKD)</th>
                    <th>單據日期</th>
                    <th>報銷事由</th>
                    <th>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {myClaims.map((c) => {
                    const status = STATUS_CONFIG[c.status]
                    return (
                      <tr key={c.id}>
                        <td className="data-table__id">{c.id}</td>
                        <td>{c.category}</td>
                        <td>HK${c.amount.toLocaleString()}</td>
                        <td>{c.date}</td>
                        <td className="data-table__remark">{c.remark}</td>
                        <td>
                          <span className={`status-badge ${status.className}`} title={status.en}>
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        )}

        {/* ===== 待我審批（依目前帳號權限過濾） ===== */}
        {activeModule === 'pending' && (
          <section className="pc-card">
            <div className="pc-card__header">
              <h2 className="pc-card__title">待我審批</h2>
              <div className="pending-meta">
                <span className="pending-count">共 {visiblePending.length} 筆待處理</span>
                {currentUser.isLevel1 && (
                  <span className="tier-chip tier-chip--1st">第 1 層：部門主管</span>
                )}
                {currentUser.isLevel2 && (
                  <span className="tier-chip tier-chip--2nd">第 2 層：財務經理</span>
                )}
              </div>
            </div>
            {visiblePending.length === 0 ? (
              <p className="empty-state">目前沒有符合您審批權限的單據。</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>單據編號</th>
                    <th>申請人</th>
                    <th>部門</th>
                    <th>費用類別</th>
                    <th>金額 (HKD)</th>
                    <th>單據日期</th>
                    <th>報銷事由</th>
                    <th>目前階段</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePending.map((c) => {
                    const status = STATUS_CONFIG[c.status]
                    return (
                      <tr key={c.id}>
                        <td className="data-table__id">{c.id}</td>
                        <td>
                          <span className="approver-cell">
                            <span className="approver-cell__avatar">{c.applicantInitials}</span>
                            {c.applicant}
                          </span>
                        </td>
                        <td>{c.department}</td>
                        <td>{c.category}</td>
                        <td>HK${c.amount.toLocaleString()}</td>
                        <td>{c.date}</td>
                        <td className="data-table__remark">{c.remark}</td>
                        <td>
                          <span className={`status-badge ${status.className}`}>{status.label}</span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button type="button" className="btn-approve" onClick={() => handleApprove(c.id)}>
                              <IconCheck size={14} /> 同意
                            </button>
                            <button type="button" className="btn-reject" onClick={() => handleReject(c.id)}>
                              <IconClose size={14} /> 駁回
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        )}

        {/* ===== 權限管理（Level 3） ===== */}
        {activeModule === 'user-mgmt' && (
          <section className="pc-card">
            <div className="pc-card__header">
              <h2 className="pc-card__title">權限管理</h2>
              <div className="pending-meta">
                <span className="pending-count">{level1Count} 位一級審批人</span>
                <span className="pending-count">{level2Count} 位二級審批人</span>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>員工</th>
                  <th>部門</th>
                  <th>存取層級</th>
                  <th>第 1 層審批權限</th>
                  <th>第 2 層審批權限</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const accessLabel = LEVEL_CONFIG[emp.accessLevel]
                  return (
                    <tr key={emp.id}>
                      <td>
                        <span className="approver-cell">
                          <span className="approver-cell__avatar">{emp.initials}</span>
                          {emp.name}
                        </span>
                      </td>
                      <td>{emp.dept}</td>
                      <td>
                        <span className={`role-tag role-tag--level-${emp.accessLevel}`}>
                          {accessLabel.label} {accessLabel.role}
                        </span>
                      </td>
                      <td>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={emp.isLevel1}
                            onChange={() => handleTogglePermission(emp.id, 'isLevel1')}
                          />
                          <span className="toggle-switch__slider" />
                        </label>
                      </td>
                      <td>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={emp.isLevel2}
                            onChange={() => handleTogglePermission(emp.id, 'isLevel2')}
                          />
                          <span className="toggle-switch__slider" />
                        </label>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  )
}

export default App