import Header from './Header'
import LayoutBody from './LayoutBody'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <Header />
      <LayoutBody>{children}</LayoutBody>
    </div>
  )
}
