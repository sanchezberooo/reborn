import EnglishModule from '@/components/modules/EnglishModule'
import GenericModule from '@/components/modules/GenericModule'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  switch (id) {
    case 'english':
      return <EnglishModule moduleId={id} />
    default:
      return <GenericModule moduleId={id} />
  }
}
