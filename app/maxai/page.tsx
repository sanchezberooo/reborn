import { redirect } from 'next/navigation'

// /maxai kökü her zaman varsayılan sekme olan Ofis'e yönlenir.
export default function MaxaiIndexPage() {
  redirect('/maxai/ofis')
}
