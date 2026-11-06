import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { api, ApiError } from './lib/api'
import type { Artifact, Catalog, Term, User } from './lib/api'

type Page = 'dashboard' | 'artifacts' | 'taxonomy' | 'users'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState<Page>('dashboard')

  useEffect(() => {
    let active = true
    api.auth.me()
      .then((value) => {
        if (active) setUser(value)
      })
      .catch((reason: unknown) => {
        if (active && !(reason instanceof ApiError && reason.status === 401)) {
          setError(errorMessage(reason))
        }
      })
      .finally(() => {
        if (active) setAuthChecked(true)
      })
    return () => {
      active = false
    }
  }, [])

  const handleLogin = async (email: string, password: string) => {
    setError('')
    try {
      const principal = await api.auth.login({ email, password })
      setUser(principal)
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  const handleLogout = async () => {
    setError('')
    try {
      await api.auth.logout()
      setUser(null)
    } catch (reason) {
      setError(errorMessage(reason))
    }
  }

  if (!authChecked) {
    return <div className="screen-loader">Đang kiểm tra phiên đăng nhập…</div>
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} error={error} />
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Museum CMS, trang chủ">
          <span className="brand-mark">M</span>
          <span>
            <strong>DI SẢN SỐ</strong>
            <small>MUSEUM CMS</small>
          </span>
        </a>
        <div className="sidebar-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav className="primary-nav" aria-label="Điều hướng chính">
          <button
            className={page === 'dashboard' ? 'nav-item active' : 'nav-item'}
            onClick={() => setPage('dashboard')}
          >
            <span className="nav-icon" aria-hidden="true">⌂</span>
            Tổng quan
          </button>
          <button
            className={page === 'artifacts' ? 'nav-item active' : 'nav-item'}
            onClick={() => setPage('artifacts')}
          >
            <span className="nav-icon" aria-hidden="true">▤</span>
            Hồ sơ hiện vật
          </button>
          <button
            className={page === 'taxonomy' ? 'nav-item active' : 'nav-item'}
            onClick={() => setPage('taxonomy')}
          >
            <span className="nav-icon" aria-hidden="true">⌘</span>
            Danh mục & thuật ngữ
          </button>
          {user.permissions.includes('user:manage') && (
            <button
              className={page === 'users' ? 'nav-item active' : 'nav-item'}
              onClick={() => setPage('users')}
            >
              <span className="nav-icon" aria-hidden="true">♙</span>
              Người dùng
            </button>
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="status-indicator"><span /> Hệ thống hoạt động</div>
          <div className="sidebar-version">Museum CMS · Giai đoạn 2</div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">BỘ SƯU TẬP <span>/</span> {page === 'dashboard' ? 'TỔNG QUAN' : page === 'artifacts' ? 'HỒ SƠ HIỆN VẬT' : page === 'taxonomy' ? 'DANH MỤC' : 'NGƯỜI DÙNG'}</div>
          <div className="user-menu">
            <div className="user-avatar" aria-hidden="true">{user.displayName.slice(0, 1).toUpperCase()}</div>
            <div className="user-meta">
              <strong>{user.displayName}</strong>
              <span>{user.email}</span>
            </div>
            <button className="text-button" onClick={handleLogout}>Đăng xuất</button>
          </div>
        </header>

        <div className="workspace">
          {error && <div className="alert error-alert" role="alert">{error}</div>}
          {page === 'dashboard' ? (
            <DashboardPage
              canWrite={user.permissions.includes('artifact:write')}
              canManageUsers={user.permissions.includes('user:manage')}
              onNavigate={setPage}
              onError={setError}
            />
          ) : page === 'artifacts' ? (
            <ArtifactsPage
              canWrite={user.permissions.includes('artifact:write')}
              onError={setError}
            />
          ) : page === 'taxonomy' ? (
            <TaxonomyPage
              canWrite={user.permissions.includes('catalog:write')}
              onError={setError}
            />
          ) : (
            <UsersPage onError={setError} />
          )}
        </div>
      </main>
    </div>
  )
}

function DashboardPage({
  canWrite,
  canManageUsers,
  onNavigate,
  onError,
}: {
  canWrite: boolean
  canManageUsers: boolean
  onNavigate: (page: Page) => void
  onError: (message: string) => void
}) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)
  const [now] = useState(() => new Date())

  useEffect(() => {
    let active = true
    Promise.all([
      api.artifacts.list({ limit: 100, offset: 0 }),
      api.catalogs.list(),
    ])
      .then(async ([artifactPage, catalogs]) => {
        const termGroups = await Promise.all(catalogs.map((catalog) => api.catalogs.terms(catalog.id)))
        const catalogTerms = termGroups.flat()
        if (active) {
          setArtifacts(artifactPage.items)
          setTerms(catalogTerms)
        }
      })
      .catch((reason: unknown) => {
        if (active) onError(errorMessage(reason))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [onError])

  const recentArtifacts = useMemo(() => [...artifacts].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 5), [artifacts])
  const classifiedCount = artifacts.filter((artifact) => artifact.terms.length > 0).length
  const draftCount = artifacts.filter((artifact) => artifact.status === 'DRAFT').length
  const coverage = artifacts.length ? Math.round(classifiedCount / artifacts.length * 100) : 0
  const monthCounts = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
      const count = artifacts.filter((artifact) => {
        const updatedAt = new Date(artifact.updatedAt)
        return updatedAt.getFullYear() === month.getFullYear() && updatedAt.getMonth() === month.getMonth()
      }).length
      return { label: new Intl.DateTimeFormat('vi-VN', { month: 'short' }).format(month), count }
    })
  }, [artifacts, now])
  const maxMonthCount = Math.max(1, ...monthCounts.map(({ count }) => count))
  const linePoints = monthCounts.map(({ count }, index) => `${12 + index * 59},${82 - (count / maxMonthCount) * 55}`).join(' ')

  return (
    <section className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <span className="eyebrow">KHÔNG GIAN LÀM VIỆC</span>
          <h1>Tổng quan bộ sưu tập</h1>
          <p>Theo dõi hồ sơ và truy cập nhanh vào công việc quản lý di sản.</p>
        </div>
        {canWrite && <button className="button primary" onClick={() => onNavigate('artifacts')}><span className="plus" aria-hidden="true">+</span> Mở hồ sơ</button>}
      </div>

      <div className="dashboard-stats">
        <article className="dashboard-stat">
          <span className="dashboard-stat-icon teal" aria-hidden="true">▤</span>
          <div><span className="dashboard-stat-label">HỒ SƠ HIỂN THỊ</span><strong>{loading ? '—' : artifacts.length}</strong><small>Tối đa 100 hồ sơ gần nhất</small></div>
        </article>
        <article className="dashboard-stat">
          <span className="dashboard-stat-icon amber" aria-hidden="true">◷</span>
          <div><span className="dashboard-stat-label">BẢN NHÁP</span><strong>{loading ? '—' : draftCount}</strong><small>Trong danh sách hiện tại</small></div>
        </article>
        <article className="dashboard-stat">
          <span className="dashboard-stat-icon violet" aria-hidden="true">⌘</span>
          <div><span className="dashboard-stat-label">THUẬT NGỮ</span><strong>{loading ? '—' : terms.length}</strong><small>Trên các danh mục hiện có</small></div>
        </article>
        <article className="dashboard-stat">
          <span className="dashboard-stat-icon green" aria-hidden="true">◉</span>
          <div><span className="dashboard-stat-label">ĐÃ PHÂN LOẠI</span><strong>{loading ? '—' : `${coverage}%`}</strong><small>{classifiedCount} / {artifacts.length} hồ sơ đang tải</small></div>
        </article>
      </div>

      <div className="dashboard-chart-grid">
        <article className="dashboard-card chart-card">
          <div className="dashboard-card-heading"><div><h2>Nhịp cập nhật hồ sơ</h2><p>Số hồ sơ trong danh sách hiện tại theo tháng</p></div><span className="chart-period">6 tháng</span></div>
          <div className="line-chart-wrap">
            <div className="chart-guides" aria-hidden="true"><i /><i /><i /></div>
            <svg className="line-chart" viewBox="0 0 320 100" role="img" aria-label="Biểu đồ số hồ sơ cập nhật theo tháng">
              <polyline points={linePoints} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {monthCounts.map(({ count }, index) => <circle key={`${index}-${count}`} cx={12 + index * 59} cy={82 - (count / maxMonthCount) * 55} r="4" />)}
            </svg>
          </div>
          <div className="chart-months">{monthCounts.map(({ label, count }, index) => <span key={`${label}-${index}`} title={`${count} hồ sơ`}>{label}</span>)}</div>
        </article>

        <article className="dashboard-card coverage-card">
          <div className="dashboard-card-heading"><div><h2>Phân loại dữ liệu</h2><p>Tình trạng phân loại của hồ sơ đang tải</p></div><span className="coverage-ring" aria-label={`Đã phân loại ${coverage}%`} style={{ '--coverage': `${coverage * 3.6}deg` } as CSSProperties}><span>{loading ? '—' : `${coverage}%`}</span></span></div>
          <div className="coverage-legend"><span><i className="legend-dot classified" /> Đã phân loại <strong>{loading ? '—' : classifiedCount}</strong></span><span><i className="legend-dot unclassified" /> Chưa phân loại <strong>{loading ? '—' : artifacts.length - classifiedCount}</strong></span></div>
          <div className="coverage-bar" aria-hidden="true"><span style={{ width: `${coverage}%` }} /></div>
          <p className="coverage-note">Số liệu chỉ tính trên 100 hồ sơ gần nhất được API trả về.</p>
        </article>
      </div>

      <div className="dashboard-bottom-grid">
        <article className="dashboard-card recent-card">
          <div className="dashboard-card-heading"><div><h2>Hồ sơ cập nhật gần đây</h2><p>Dữ liệu mới nhất từ bộ sưu tập</p></div><button className="dashboard-link" onClick={() => onNavigate('artifacts')}>Xem tất cả <span aria-hidden="true">→</span></button></div>
          {loading ? <div className="dashboard-empty">Đang tải hồ sơ…</div> : recentArtifacts.length === 0 ? <div className="dashboard-empty">Chưa có hồ sơ để hiển thị.</div> : <div className="recent-list">{recentArtifacts.map((artifact) => <div className="recent-row" key={artifact.id}><span className="recent-thumb" aria-hidden="true">✦</span><div className="recent-copy"><strong>{artifact.translations[0]?.title ?? 'Chưa có tiêu đề'}</strong><small>{artifact.accessionNumber}</small></div><span className="status-badge draft">{artifact.status === 'DRAFT' ? 'Bản nháp' : artifact.status}</span><time>{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(artifact.updatedAt))}</time></div>)}</div>}
        </article>

        <article className="dashboard-card shortcuts-card">
          <div className="dashboard-card-heading"><div><h2>Truy cập nhanh</h2><p>Đi tới khu vực làm việc</p></div></div>
          <button className="shortcut-row" onClick={() => onNavigate('artifacts')}><span className="shortcut-icon teal">▤</span><span><strong>Hồ sơ hiện vật</strong><small>Tạo và cập nhật hồ sơ</small></span><b aria-hidden="true">→</b></button>
          <button className="shortcut-row" onClick={() => onNavigate('taxonomy')}><span className="shortcut-icon amber">⌘</span><span><strong>Danh mục & thuật ngữ</strong><small>Chuẩn hóa dữ liệu</small></span><b aria-hidden="true">→</b></button>
          {canManageUsers && <button className="shortcut-row" onClick={() => onNavigate('users')}><span className="shortcut-icon violet">♙</span><span><strong>Người dùng</strong><small>Tài khoản và vai trò</small></span><b aria-hidden="true">→</b></button>}
        </article>
      </div>
    </section>
  )
}

function UsersPage({ onError }: { onError: (message: string) => void }) {
  const [users, setUsers] = useState<import('./lib/api').AdminUser[]>([])
  const [roles, setRoles] = useState<import('./lib/api').AssignableRole[]>([])
  const [editing, setEditing] = useState<import('./lib/api').AdminUser | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [userRows, roleRows] = await Promise.all([api.users.list(), api.users.roles()])
      setUsers(userRows)
      setRoles(roleRows)
    } catch (reason) {
      onError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }, [onError])

  // The effect synchronizes server state after navigation.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void load() }, [load])

  return (
    <section>
      <div className="page-heading">
        <div><span className="eyebrow">QUẢN TRỊ TRUY CẬP</span><h1>Người dùng</h1><p>Quản lý tài khoản nội bộ và phạm vi quyền được cấp.</p></div>
        <button className="button primary" onClick={() => setEditing(null)}><span className="plus" aria-hidden="true">+</span> Tạo tài khoản</button>
      </div>
      <div className="data-card">
        <div className="data-card-header"><div><h2>Tài khoản nội bộ</h2><p>Khóa tài khoản sẽ thu hồi toàn bộ phiên đăng nhập đang hoạt động.</p></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>TÊN</th><th>EMAIL</th><th>VAI TRÒ</th><th>TRẠNG THÁI</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="table-state">Đang tải người dùng…</td></tr> : users.length === 0 ? <tr><td colSpan={5} className="table-state">Chưa có tài khoản.</td></tr> : users.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.displayName}</strong></td>
                  <td>{item.email}</td>
                  <td><div className="tag-list">{item.roles.length ? item.roles.map((role) => <span className="tag" key={role.id}>{role.name}</span>) : <span className="muted">Chưa gán</span>}</div></td>
                  <td><span className={item.status === 'ACTIVE' ? 'status-badge active' : 'status-badge disabled'}>{item.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</span></td>
                  <td><button className="button secondary" onClick={() => setEditing(item)}>Chỉnh sửa</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing !== undefined && (
        <UserDialog
          user={editing}
          roles={roles}
          onClose={() => setEditing(undefined)}
          onSaved={async () => { setEditing(undefined); setLoading(true); await load() }}
          onError={onError}
        />
      )}
    </section>
  )
}

function UserDialog({
  user,
  roles,
  onClose,
  onSaved,
  onError,
}: {
  user: import('./lib/api').AdminUser | null
  roles: import('./lib/api').AssignableRole[]
  onClose: () => void
  onSaved: () => Promise<void>
  onError: (message: string) => void
}) {
  const [email, setEmail] = useState(user?.email ?? '')
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [initialPassword, setInitialPassword] = useState('')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState(user?.status ?? 'ACTIVE')
  const [roleIds, setRoleIds] = useState(user?.roles.map((role) => role.id) ?? [])
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    onError('')
    try {
      if (user) {
        await api.users.update(user.id, { expectedVersion: user.version, displayName, status, roleIds, reason })
      } else {
        await api.users.create({ email, displayName, initialPassword, roleIds, reason })
      }
      await onSaved()
    } catch (reason) {
      onError(errorMessage(reason))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onKeyDown={(event) => { if (event.key === 'Escape') onClose() }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
        <div className="modal-header"><div><span className="eyebrow">QUẢN TRỊ TRUY CẬP</span><h2 id="user-dialog-title">{user ? 'Cập nhật tài khoản' : 'Tạo tài khoản'}</h2></div><button className="close-button" onClick={onClose} aria-label="Đóng">×</button></div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="span-two">Tên hiển thị<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={120} required /></label>
            {!user && <label className="span-two">Email<input type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={320} required /></label>}
            {!user && <label className="span-two">Mật khẩu ban đầu<input type="password" autoComplete="new-password" value={initialPassword} onChange={(event) => setInitialPassword(event.target.value)} minLength={12} maxLength={1024} required /><small className="muted">Tối thiểu 12 ký tự; cấp mật khẩu cho người dùng qua kênh an toàn.</small></label>}
            <label className="span-two">Lý do thay đổi<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={500} rows={2} required placeholder="Ví dụ: tiếp nhận cán bộ phụ trách bộ sưu tập…" /></label>
            {user && <label className="span-two">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as 'ACTIVE' | 'DISABLED')}><option value="ACTIVE">Đang hoạt động</option><option value="DISABLED">Đã khóa</option></select></label>}
            <fieldset className="span-two term-picker"><legend>Vai trò có thể cấp</legend>
              {roles.length === 0 ? <p className="muted">Bạn chưa có vai trò nào để cấp.</p> : <div className="checkbox-grid">{roles.map((role) => <label className="checkbox-label" key={role.id}><input type="checkbox" checked={roleIds.includes(role.id)} onChange={(event) => setRoleIds((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id))} /><span><strong>{role.name}</strong><small className="muted">{role.permissions.join(', ') || 'Không có quyền'}</small></span></label>)}</div>}
            </fieldset>
          </div>
          <div className="modal-actions"><span /><button type="button" className="button secondary" onClick={onClose}>Hủy</button><button className="button primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu tài khoản'}</button></div>
        </form>
      </section>
    </div>
  )
}

function LoginScreen({
  onLogin,
  error,
}: {
  onLogin: (email: string, password: string) => Promise<void>
  error: string
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    await onLogin(email, password)
    setSubmitting(false)
  }

  return (
    <main className="login-screen">
      <div className="login-art">
        <div className="login-art-copy">
          <span className="eyebrow">NỀN TẢNG QUẢN TRỊ DI SẢN</span>
          <h1>Gìn giữ câu chuyện.<br /><em>Kết nối di sản.</em></h1>
          <p>Một không gian làm việc thống nhất để quản lý, bảo tồn và chia sẻ những giá trị văn hóa.</p>
        </div>
        <div className="artifact-stamp" aria-hidden="true">
          <span>COLLECTION</span>
          <strong>01</strong>
          <small>EST. HERITAGE</small>
        </div>
      </div>
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel-inner">
          <div className="brand login-brand">
            <span className="brand-mark">M</span>
            <span><strong>DI SẢN SỐ</strong><small>MUSEUM CMS</small></span>
          </div>
          <span className="eyebrow">CHÀO MỪNG TRỞ LẠI</span>
          <h2 id="login-title">Đăng nhập</h2>
          <p className="muted">Sử dụng tài khoản được cấp để tiếp tục.</p>
          <form className="login-form" onSubmit={submit}>
            <label>
              Email
              <input
                autoComplete="username"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ten@baotang.vn"
                required
              />
            </label>
            <label>
              Mật khẩu
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {error && <div className="alert error-alert" role="alert">{error}</div>}
            <button className="button primary full-width" disabled={submitting}>
              {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <div className="login-note">Phiên làm việc được bảo vệ và tự kết thúc sau 8 giờ.</div>
        </div>
        <div className="login-copyright">© 2026 Museum Digital · Bảo tồn giá trị văn hóa</div>
      </section>
    </main>
  )
}

function ArtifactsPage({
  canWrite,
  onError,
}: {
  canWrite: boolean
  onError: (message: string) => void
}) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [editing, setEditing] = useState<Artifact | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [artifactPage, catalogs] = await Promise.all([
        api.artifacts.list({ limit: 100, offset, ...(query ? { search: query } : {}) }),
        api.catalogs.list(),
      ])
      setArtifacts((current) => offset === 0 ? artifactPage.items : [...current, ...artifactPage.items])
      setHasMore(artifactPage.hasMore)
      if (catalogs[0]) {
        setTerms(await api.catalogs.terms(catalogs[0].id))
      } else {
        setTerms([])
      }
    } catch (reason) {
      onError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }, [onError, query, offset])

  // The effect synchronizes server state; state updates happen after the async requests settle.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void load() }, [load, refreshVersion])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setOffset(0)
    setQuery(search.trim())
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUẢN LÝ BỘ SƯU TẬP</span>
          <h1>Hồ sơ hiện vật</h1>
          <p>Theo dõi và cập nhật thông tin hiện vật trong bộ sưu tập.</p>
        </div>
        {canWrite && (
          <button className="button primary" onClick={() => setEditing(null)}>
            <span className="plus" aria-hidden="true">+</span> Tạo hồ sơ
          </button>
        )}
      </div>
      <div className="stat-grid">
        <div className="stat-card"><span>TỔNG HỒ SƠ HIỂN THỊ</span><strong>{artifacts.length}</strong><small>Trong danh sách hiện tại</small></div>
        <div className="stat-card"><span>ĐANG Ở BẢN NHÁP</span><strong>{artifacts.filter((item) => item.status === 'DRAFT').length}</strong><small>Sẵn sàng tiếp tục biên tập</small></div>
        <div className="stat-card"><span>THUẬT NGỮ ĐÃ TẠO</span><strong>{terms.length}</strong><small>Trong danh mục chung</small></div>
      </div>
      <div className="data-card">
        <div className="data-card-header">
          <div><h2>Danh sách hiện vật</h2><p>Dữ liệu được cập nhật theo lần chỉnh sửa gần nhất.</p></div>
          <form className="search-form" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="artifact-search">Tìm hiện vật</label>
            <input id="artifact-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã hồ sơ, tên hiện vật…" />
            <button className="button secondary" type="submit">Tìm kiếm</button>
          </form>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>MÃ HỒ SƠ</th><th>TÊN HIỆN VẬT</th><th>PHÂN LOẠI</th><th>TRẠNG THÁI</th><th>CẬP NHẬT</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="table-state">Đang tải hồ sơ…</td></tr>
              ) : artifacts.length === 0 ? (
                <tr><td colSpan={6} className="table-state">Chưa có hồ sơ phù hợp. Hãy tạo hồ sơ đầu tiên.</td></tr>
              ) : artifacts.map((artifact) => (
                <tr key={artifact.id}>
                  <td><span className="accession">{artifact.accessionNumber}</span></td>
                  <td><strong>{artifact.translations[0]?.title ?? 'Chưa có tiêu đề'}</strong><small className="row-description">{artifact.translations[0]?.descriptionText || 'Chưa có mô tả'}</small></td>
                  <td><div className="tag-list">{artifact.terms.length ? artifact.terms.slice(0, 2).map(({ term }) => <span className="tag" key={term.id}>{term.translations[0]?.label ?? term.code}</span>) : <span className="muted">Chưa phân loại</span>}</div></td>
                  <td><span className="status-badge draft">{artifact.status === 'DRAFT' ? 'Bản nháp' : artifact.status}</span></td>
                  <td className="date-cell">{new Intl.DateTimeFormat('vi-VN').format(new Date(artifact.updatedAt))}</td>
                  <td>{canWrite && <button className="icon-button" aria-label={`Chỉnh sửa ${artifact.accessionNumber}`} onClick={() => setEditing(artifact)}>•••</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Đang hiển thị {artifacts.length} hồ sơ{hasMore ? '' : ' · Đã hết kết quả'}.</span>
          {hasMore && <button className="button secondary" disabled={loading} onClick={() => setOffset((current) => current + 100)}>Tải thêm</button>}
        </div>
      </div>
      {editing !== undefined && (
        <ArtifactDialog
          artifact={editing}
          terms={terms}
          onClose={() => setEditing(undefined)}
          onSaved={async () => { setEditing(undefined); setOffset(0); setLoading(true); setRefreshVersion((current) => current + 1) }}
          onError={onError}
        />
      )}
    </section>
  )
}

function ArtifactDialog({
  artifact,
  terms,
  onClose,
  onSaved,
  onError,
}: {
  artifact: Artifact | null
  terms: Term[]
  onClose: () => void
  onSaved: () => Promise<void>
  onError: (message: string) => void
}) {
  const translation = artifact?.translations[0]
  const [accessionNumber, setAccessionNumber] = useState(artifact?.accessionNumber ?? '')
  const [title, setTitle] = useState(translation?.title ?? '')
  const [description, setDescription] = useState(translation?.descriptionText ?? '')
  const [termIds, setTermIds] = useState(artifact?.terms.map(({ term }) => term.id) ?? [])
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    onError('')
    try {
      if (artifact) {
        await api.artifacts.update(artifact.id, {
          accessionNumber,
          title,
          description,
          termIds,
          expectedVersion: artifact.version,
        })
      } else {
        await api.artifacts.create({ accessionNumber, title, description, termIds })
      }
      await onSaved()
    } catch (reason) {
      onError(errorMessage(reason))
    } finally {
      setSaving(false)
    }
  }

  const archive = async () => {
    if (!artifact || !window.confirm(`Lưu trữ hồ sơ ${artifact.accessionNumber}?`)) return
    setSaving(true)
    onError('')
    try {
      await api.artifacts.archive(artifact.id, { expectedVersion: artifact.version })
      await onSaved()
    } catch (reason) {
      onError(errorMessage(reason))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onKeyDown={(event) => { if (event.key === 'Escape') onClose() }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="artifact-dialog-title">
        <div className="modal-header">
          <div><span className="eyebrow">{artifact ? 'CẬP NHẬT BỘ SƯU TẬP' : 'THÊM VÀO BỘ SƯU TẬP'}</span><h2 id="artifact-dialog-title">{artifact ? 'Chỉnh sửa hồ sơ' : 'Tạo hồ sơ hiện vật'}</h2></div>
          <button className="close-button" onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="span-two">Mã hồ sơ
              <input autoFocus value={accessionNumber} onChange={(event) => setAccessionNumber(event.target.value)} maxLength={100} required />
            </label>
            <label className="span-two">Tên hiện vật
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} required />
            </label>
            <label className="span-two">Mô tả
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} maxLength={20_000} placeholder="Mô tả nguồn gốc, chất liệu hoặc giá trị lịch sử…" />
            </label>
            <fieldset className="span-two term-picker">
              <legend>Phân loại theo thuật ngữ</legend>
              {terms.length === 0 ? <p className="muted">Chưa có thuật ngữ. Tạo thuật ngữ trong mục Danh mục.</p> : (
                <div className="checkbox-grid">
                  {terms.map((term) => (
                    <label className="checkbox-label" key={term.id}>
                      <input
                        type="checkbox"
                        checked={termIds.includes(term.id)}
                        onChange={(event) => setTermIds((current) => event.target.checked ? [...current, term.id] : current.filter((id) => id !== term.id))}
                      />
                      {term.translations[0]?.label ?? term.code}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          </div>
          <div className="modal-actions">
            {artifact && <button type="button" className="button danger-ghost" onClick={archive} disabled={saving}>Lưu trữ hồ sơ</button>}
            <span />
            <button type="button" className="button secondary" onClick={onClose}>Hủy</button>
            <button className="button primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
          </div>
        </form>
      </section>
    </div>
  )
}

function TaxonomyPage({
  canWrite,
  onError,
}: {
  canWrite: boolean
  onError: (message: string) => void
}) {
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [catalogId, setCatalogId] = useState('')
  const [terms, setTerms] = useState<Term[]>([])
  const [editing, setEditing] = useState<Term | null | undefined>(undefined)
  const [showCatalogForm, setShowCatalogForm] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadCatalogs = useCallback(async () => {
    try {
      const values = await api.catalogs.list()
      setCatalogs(values)
      setCatalogId((current) => current && values.some((item) => item.id === current) ? current : values[0]?.id ?? '')
      if (values.length === 0) {
        setTerms([])
        setLoading(false)
      }
    } catch (reason) {
      onError(errorMessage(reason))
    }
  }, [onError])

  // The effect synchronizes server state; state updates happen after the async request settles.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void loadCatalogs() }, [loadCatalogs])

  const loadTerms = useCallback(async () => {
    if (!catalogId) return
    try {
      setTerms(await api.catalogs.terms(catalogId))
    } catch (reason) {
      onError(errorMessage(reason))
    } finally {
      setLoading(false)
    }
  }, [catalogId, onError])

  // The effect synchronizes server state; state updates happen after the async request settles.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void loadTerms() }, [loadTerms])

  const currentCatalog = useMemo(() => catalogs.find((item) => item.id === catalogId), [catalogId, catalogs])

  const archive = async (term: Term) => {
    const label = term.translations[0]?.label ?? term.code
    if (!window.confirm(`Lưu trữ thuật ngữ “${label}”?`)) return
    onError('')
    try {
      await api.terms.archive(term.id, { expectedVersion: term.version })
      setLoading(true)
      await loadTerms()
      await loadCatalogs()
    } catch (reason) {
      onError(errorMessage(reason))
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div><span className="eyebrow">TỔ CHỨC TRI THỨC</span><h1>Danh mục & thuật ngữ</h1><p>Quản lý hệ phân loại và các khái niệm dùng chung.</p></div>
        {canWrite && <button className="button primary" onClick={() => setShowCatalogForm(true)}><span className="plus" aria-hidden="true">+</span> Tạo danh mục</button>}
      </div>
      <div className="taxonomy-layout">
        <aside className="catalog-card">
          <div className="panel-heading"><h2>Danh mục</h2><span className="count-pill">{catalogs.length}</span></div>
          {catalogs.map((catalog) => (
            <button key={catalog.id} className={catalogId === catalog.id ? 'catalog-choice selected' : 'catalog-choice'} onClick={() => { if (catalog.id !== catalogId) { setLoading(true); setCatalogId(catalog.id) } }}>
              <span className="catalog-icon" aria-hidden="true">▦</span>
              <span><strong>{catalog.name}</strong><small>{catalog._count?.terms ?? 0} thuật ngữ</small></span>
              <span className="chevron" aria-hidden="true">›</span>
            </button>
          ))}
          {catalogs.length === 0 && <p className="empty-note">Chưa có danh mục.</p>}
        </aside>
        <div className="terms-card">
          <div className="terms-header">
            <div><span className="eyebrow">DANH MỤC ĐANG CHỌN</span><h2>{currentCatalog?.name ?? 'Chưa có danh mục'}</h2><p>Mã danh mục <code>{currentCatalog?.code ?? '—'}</code></p></div>
            {canWrite && catalogId && <button className="button secondary" onClick={() => setEditing(null)}>+ Thêm thuật ngữ</button>}
          </div>
          {editing !== undefined && canWrite && (
            <TermForm
              key={editing?.id ?? 'new'}
              catalogId={catalogId}
              terms={terms}
              term={editing}
              onCancel={() => setEditing(undefined)}
              onSaved={async () => { setEditing(undefined); setLoading(true); await loadTerms(); await loadCatalogs() }}
              onError={onError}
            />
          )}
          <div className="terms-list">
            {loading ? <div className="table-state">Đang tải thuật ngữ…</div> : terms.length === 0 ? <div className="table-state">Danh mục này chưa có thuật ngữ.</div> : terms.map((term) => (
              <div className="term-row" key={term.id}>
                <span className="term-symbol" aria-hidden="true">⌑</span>
                <div className="term-main"><strong>{term.translations[0]?.label ?? 'Chưa có nhãn'}</strong><small>{term.code}{term.parentId ? ' · Thuật ngữ con' : ''}</small></div>
                <span className="term-usage">{term._count?.artifactLinks ?? 0} hồ sơ</span>
                {canWrite && <div className="term-actions"><button className="text-button" onClick={() => setEditing(term)}>Sửa</button><button className="text-button danger-text" onClick={() => void archive(term)}>Lưu trữ</button></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
      {showCatalogForm && (
        <CatalogDialog
          onClose={() => setShowCatalogForm(false)}
          onSaved={async () => { setShowCatalogForm(false); await loadCatalogs() }}
          onError={onError}
        />
      )}
    </section>
  )
}

function TermForm({
  catalogId,
  terms,
  term,
  onCancel,
  onSaved,
  onError,
}: {
  catalogId: string
  terms: Term[]
  term: Term | null
  onCancel: () => void
  onSaved: () => Promise<void>
  onError: (message: string) => void
}) {
  const [code, setCode] = useState(term?.code ?? '')
  const [label, setLabel] = useState(term?.translations[0]?.label ?? '')
  const [description, setDescription] = useState(term?.translations[0]?.description ?? '')
  const [parentId, setParentId] = useState(term?.parentId ?? '')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    onError('')
    try {
      if (term) {
        await api.terms.update(term.id, {
          code,
          label,
          description,
          parentId: parentId || null,
          expectedVersion: term.version,
        })
      } else {
        await api.catalogs.createTerm(catalogId, {
          code,
          label,
          description,
          parentId: parentId || null,
        })
      }
      await onSaved()
    } catch (reason) {
      onError(errorMessage(reason))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="inline-form" onSubmit={submit}>
      <div className="panel-heading"><h3>{term ? 'Chỉnh sửa thuật ngữ' : 'Thuật ngữ mới'}</h3><button type="button" className="close-button small-close" onClick={onCancel} aria-label="Đóng">×</button></div>
      <div className="form-grid">
        <label>Mã thuật ngữ<input autoFocus value={code} onChange={(event) => setCode(event.target.value)} maxLength={100} required /></label>
        <label>Tên hiển thị<input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={200} required /></label>
        <label className="span-two">Thuật ngữ cha
          <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">Không có (cấp gốc)</option>
            {terms.filter((item) => item.id !== term?.id).map((item) => <option key={item.id} value={item.id}>{item.translations[0]?.label ?? item.code}</option>)}
          </select>
        </label>
        <label className="span-two">Mô tả<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={2000} /></label>
      </div>
      <div className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>Hủy</button><button className="button primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu thuật ngữ'}</button></div>
    </form>
  )
}

function CatalogDialog({
  onClose,
  onSaved,
  onError,
}: {
  onClose: () => void
  onSaved: () => Promise<void>
  onError: (message: string) => void
}) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    onError('')
    try {
      await api.catalogs.create({ code, name })
      await onSaved()
    } catch (reason) {
      onError(errorMessage(reason))
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="modal-backdrop" onKeyDown={(event) => { if (event.key === 'Escape') onClose() }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-card compact-modal" role="dialog" aria-modal="true" aria-labelledby="catalog-dialog-title">
        <div className="modal-header"><div><span className="eyebrow">TỔ CHỨC TRI THỨC</span><h2 id="catalog-dialog-title">Tạo danh mục</h2></div><button className="close-button" onClick={onClose} aria-label="Đóng">×</button></div>
        <form onSubmit={submit} className="login-form">
          <label>Mã danh mục<input autoFocus value={code} onChange={(event) => setCode(event.target.value)} maxLength={50} placeholder="VD: MATERIALS" required /></label>
          <label>Tên danh mục<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></label>
          <div className="modal-actions"><span /><button type="button" className="button secondary" onClick={onClose}>Hủy</button><button className="button primary" disabled={saving}>{saving ? 'Đang lưu…' : 'Tạo danh mục'}</button></div>
        </form>
      </section>
    </div>
  )
}

function errorMessage(reason: unknown): string {
  if (reason instanceof ApiError && reason.status >= 500) {
    return 'Không thể kết nối dịch vụ. Hãy kiểm tra API và cơ sở dữ liệu đang chạy.';
  }
  return reason instanceof Error ? reason.message : 'Đã xảy ra lỗi không xác định.'
}

export default App
