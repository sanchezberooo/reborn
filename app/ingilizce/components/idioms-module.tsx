'use client'

import { LevelTabsLayout, WordList, GrammarBox, type LevelContent } from './level-tabs'

const CONTENT: LevelContent = {
  A1: [
    {
      id: 'basic-expressions',
      title: 'Temel İfadeler — Basic Expressions',
      body: <WordList words={[
        { en: 'Good luck!', tr: 'İyi şanslar!' }, { en: 'Well done!', tr: 'Aferin! / Bravo!' },
        { en: 'No problem', tr: 'Sorun değil' }, { en: 'Of course!', tr: 'Tabii ki!' },
        { en: 'I see.', tr: 'Anlıyorum.' }, { en: "Don't worry!", tr: 'Merak etme!' },
        { en: 'Here you are.', tr: 'Buyurun.' }, { en: "You're welcome.", tr: 'Rica ederim.' },
        { en: 'Excuse me.', tr: 'Pardon / Özür dilerim.' }, { en: "I don't understand.", tr: 'Anlamadım.' },
        { en: 'Can you repeat that?', tr: 'Tekrar eder misiniz?' }, { en: "I don't know.", tr: 'Bilmiyorum.' },
      ]} />,
    },
    {
      id: 'basic-patterns',
      title: 'Basit Kalıplar — Simple Patterns',
      body: <GrammarBox
        formula="I like/love/hate + noun/verb-ing"
        examples={[
          'I like coffee. / I love reading. / I hate waking up early.',
          'I want to + verb: I want to travel. (Seyahat etmek istiyorum.)',
          "I need to + verb: I need to study. (Çalışmam gerekiyor.)",
          "I can + verb: I can speak Turkish. (Türkçe konuşabiliyorum.)",
        ]}
        tip="Bu kalıplar her seviyede kullanılır. 'I like', 'I want', 'I can' ile güçlü cümleler kur."
      />,
    },
  ],
  A2: [
    {
      id: 'useful-phrases',
      title: 'Kullanışlı Deyimler — Useful Phrases',
      body: <WordList words={[
        { en: 'as soon as possible', tr: 'mümkün olan en kısa sürede' }, { en: 'by the way', tr: 'bu arada' },
        { en: 'on the other hand', tr: 'öte yandan' }, { en: 'in fact', tr: 'aslında / gerçekte' },
        { en: 'for example', tr: 'örneğin' }, { en: 'such as', tr: 'gibi / örneğin' },
        { en: 'at the moment', tr: 'şu an / şu sıralar' }, { en: 'in the end', tr: 'sonunda' },
        { en: 'at least', tr: 'en azından' }, { en: 'more or less', tr: 'aşağı yukarı / az çok' },
      ]} />,
    },
    {
      id: 'sentence-patterns',
      title: 'Cümle Kalıpları — Sentence Patterns',
      body: <GrammarBox
        formula="However, ... | Although ..., ... | Because of ..., ..."
        examples={[
          'However, the results were different. (Ancak sonuçlar farklıydı.)',
          'Although it was raining, we went out. (Yağmur yağmasına rağmen dışarı çıktık.)',
          'Because of the traffic, I was late. (Trafik yüzünden geç kaldım.)',
          "I would like to + verb: I'd like to book a table. (Masa ayırtmak istiyorum.)",
        ]}
        tip="Bu bağlaçlar ve kalıplar yazılı ve sözlü İngilizceni daha akıcı gösterir."
      />,
    },
  ],
  B1: [
    {
      id: 'idioms-b1',
      title: 'B1 Deyimler — Idioms',
      body: <GrammarBox
        formula="Idiom = figurative meaning (gerçek anlamından farklı)"
        examples={[
          'piece of cake → very easy (çok kolay): "This exam was a piece of cake!"',
          'under the weather → feeling ill (hasta hissetmek): "I\'m feeling under the weather today."',
          'once in a blue moon → very rarely (çok nadir): "I eat fast food once in a blue moon."',
          'break the ice → start conversation (buzu kırmak): "He told a joke to break the ice."',
          'bite the bullet → endure something unpleasant (dişini sıkmak): "I had to bite the bullet and apologise."',
          'hit the nail on the head → exactly right (tam isabetle): "You hit the nail on the head!"',
        ]}
        tip="İdiomları kelimesi kelimesine çevirme — bütünün anlamına bak. Bağlamda öğrenmek en etkili yöntemdir."
      />,
    },
    {
      id: 'discourse-markers',
      title: 'Bağlantı Sözcükleri — Discourse Markers',
      body: <GrammarBox
        formula="Linking words that show relationship between ideas"
        examples={[
          'However, ... / Nevertheless, ... → contrast (zıtlık)',
          'Furthermore, ... / Moreover, ... / In addition, ... → adding (ekleme)',
          'Therefore, ... / As a result, ... / Consequently, ... → result (sonuç)',
          'For instance, ... / For example, ... / Such as ... → example (örnek)',
          'In conclusion, ... / To sum up, ... → summary (özet)',
          'Although, ... / Despite the fact that, ... → concession (kabul etme)',
        ]}
        tip="Bu sözcükler IELTS Writing Task 2'de çok önemlidir. Her paragrafta en az 1-2 tane kullan."
      />,
    },
    {
      id: 'ielts-patterns',
      title: 'IELTS Yazı Kalıpları — IELTS Writing Patterns',
      body: <GrammarBox
        formula="Academic patterns for Task 2 essays"
        examples={[
          'It is widely believed that ... (Genel olarak inanılır ki...)',
          'There is no doubt that ... (Şüphe yok ki...)',
          'It could be argued that ... (Şunu iddia edebiliriz ki...)',
          'The main advantage/disadvantage of ... is ... ',
          'This suggests/indicates/implies that ...',
          'While/Whereas ... , ... (İki zıt fikir için)',
        ]}
        tip="Bu kalıpları ezberleme, bağlamda kullanmayı pratik et. Doğal kullanım puan verir."
      />,
    },
  ],
}

export function IdiomsModule() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: '#ffffff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Deyimler & Kalıplar</h2>
        <p style={{ color: '#a0a0a0', fontSize: 13 }}>Günlük deyimler, cümle kalıpları ve bağlantı sözcükleri.</p>
      </div>
      <LevelTabsLayout moduleKey="idioms" content={CONTENT} />
    </div>
  )
}
