import GenericModule from '@/components/modules/GenericModule'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <GenericModule moduleId={id} />
}
