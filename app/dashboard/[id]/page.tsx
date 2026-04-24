import ModuleDetail from '@/components/dashboard/ModuleDetail'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ModuleDetail moduleId={id} />
}
