'use client'

import { LevelTabsLayout, WritingCard, type LevelContent } from './level-tabs'

const CONTENT: LevelContent = {
  A1: [
    {
      id: 'self-intro',
      title: 'Kendini Tanıtma — Self Introduction',
      body: <WritingCard
        template={`My name is _______. I am _______ years old.
I am from _______ and I live in _______.
I am a/an _______. (student / teacher / engineer...)
I have _______ (family members).
My hobbies are _______ and _______.
My favourite _______ is _______.`}
        blanks={[
          "Hi! My name is ___. I am ___ years old and I live in ___.",
          "I am a student at ___ school. I study ___.",
          "In my free time, I like to ___ and ___.",
          "My favourite food is ___ and my favourite colour is ___.",
        ]}
        example="My name is Ali. I am 20 years old. I am from Turkey and I live in Istanbul. I am a student. I have one sister and two brothers. My hobbies are reading and playing football. My favourite food is pizza."
      />,
    },
    {
      id: 'my-family',
      title: 'Ailem Hakkında 5 Cümle — My Family',
      body: <WritingCard
        template={`1. I have ___ people in my family.
2. My ___ is/are ___ years old.
3. My father/mother works as a/an ___.
4. My favourite family member is ___ because ___.
5. We usually ___ together at weekends.`}
        blanks={[
          "I have ___ people in my family: my mother, father, and ___.",
          "My mother is a ___ and my father is a ___.",
          "My sister/brother is ___ years old and she/he likes ___.",
          "We usually ___ (eat dinner / watch TV / go to the park) together.",
        ]}
        example="I have four people in my family. My father is 45 years old and he is a doctor. My mother is a teacher. I have one sister. Her name is Zeynep and she is 15 years old. We usually have dinner together every evening."
      />,
    },
    {
      id: 'daily-routine',
      title: 'Günlük Rutin — Daily Routine',
      body: <WritingCard
        template={`I wake up at ___ every day.
First, I ___ (eat breakfast / have a shower / get dressed).
Then I go to ___ by ___ (bus / car / foot).
At ___ o'clock, I ___.
In the afternoon, I usually ___.
In the evening, I like to ___.
I go to bed at ___.`}
        blanks={[
          "I wake up at ___ o'clock. First, I ___.",
          "I go to school/work by ___. My school/work starts at ___.",
          "At lunchtime, I eat ___ with ___.",
          "After school/work, I ___ for about ___ minutes/hours.",
          "I go to bed at ___ o'clock.",
        ]}
        example="I wake up at 7 o'clock every day. First, I have a shower and then eat breakfast. I go to school by bus. My lessons start at 8:30. At lunchtime, I eat in the canteen with my friends. After school, I do my homework for about one hour. In the evening, I watch TV or play games. I go to bed at 10:30."
      />,
    },
  ],
  A2: [
    {
      id: 'formal-email',
      title: 'Resmi E-posta — Formal Email',
      body: <WritingCard
        template={`Subject: [Konu]

Dear Mr/Ms [Soyadı],

I am writing to [amaç: request / inform / complain / apply for...].

[Ana paragraf: gerekli bilgileri ver]

[Sonuç: ne istediğini yaz]

I look forward to hearing from you.

Yours sincerely,
[İsim]`}
        blanks={[
          "Dear ___, I am writing to request information about ___.",
          "I would be grateful if you could ___ (send / provide / confirm).",
          "Please find attached ___ (my CV / the form / the documents).",
          "If you require further information, please do not hesitate to contact me.",
          "I look forward to ___ (hearing from you / receiving your reply).",
        ]}
        example={`Subject: Request for Course Information

Dear Ms Johnson,

I am writing to request information about your English language courses for the summer term. I am particularly interested in the B1 level course. Could you please send me details about the schedule, fees, and enrollment process?

I look forward to hearing from you.

Yours sincerely,
Ali Yılmaz`}
      />,
    },
    {
      id: 'informal-email',
      title: 'Samimi E-posta — Informal Email',
      body: <WritingCard
        template={`Hi [İsim]!

How are you? / Hope you're well!

[Neden yazıyorsun — haber ver / davet et / özür dile]

[Ana bilgi veya hikaye — 2-3 cümle]

[Soru sor veya bir şey iste]

Write back soon!
[İsmin]`}
        blanks={[
          "Hi ___, How are you? I'm writing because ___.",
          "Last week, I ___ and it was really ___.",
          "I was wondering if you'd like to ___ next ___.",
          "Let me know what you think! / Write back soon!",
        ]}
        example={`Hi Sara!

How are you? Hope things are going well in Ankara!

I just wanted to tell you about my trip to Cappadocia last weekend. It was absolutely amazing — we watched the sunrise from a hot air balloon!

Are you free next month? I'd love to meet up and show you the photos.

Can't wait to hear from you!
Beren`}
      />,
    },
    {
      id: 'short-story',
      title: 'Kısa Hikaye — Short Story',
      body: <WritingCard
        template={`Beginning: Set the scene — who, where, when
"It was a [day] when [character] [action]..."

Middle: What happened? What was the problem?
"Suddenly, ..." / "Then, ..." / "However, ..."

End: How did it finish?
"In the end, ..." / "Finally, ..."`}
        blanks={[
          "It was a ___ (stormy / sunny / cold) ___ (morning/evening) when ___.",
          "Suddenly, ___ happened. ___ felt ___ (shocked / excited / scared).",
          "He/She decided to ___ because ___.",
          "In the end, ___ and ___ felt ___.",
        ]}
        example="It was a cold Friday evening when I heard a strange sound outside. I looked out but couldn't see anything. Suddenly, a small cat jumped onto the windowsill. It was wet and shivering. I immediately opened the window and let it in. I gave it some warm milk and a blanket. In the end, the cat fell asleep on my sofa. I decided to keep it and named it Luna."
      />,
    },
    {
      id: 'describe-place',
      title: 'Yer Tanıtma — Describing a Place',
      body: <WritingCard
        template={`Introduction: Name and location
"[Place] is located in [city/country]. It is known for..."

Description: What does it look like? What can you do there?
"The [place] is [size/type]. There are / You can see..."

Personal opinion or recommendation:
"I think [place] is... because... I would recommend it to..."`}
        blanks={[
          "___ is a ___ (city / park / building) in ___.",
          "It is famous for its ___ (history / nature / food / culture).",
          "Visitors can ___ (visit / see / eat / enjoy) ___.",
          "I think ___ is ___ because ___. I would recommend it to ___.",
        ]}
        example="Ephesus is an ancient city located near İzmir, in western Turkey. It is known for its remarkably well-preserved ruins, including the Library of Celsus. Visitors can spend a whole day exploring the streets and theatres. I think Ephesus is fascinating because it brings history to life. I would especially recommend it to anyone who loves archaeology."
      />,
    },
  ],
  B1: [
    {
      id: 'opinion-paragraph',
      title: 'Fikir Paragrafı — Opinion Paragraph',
      body: <WritingCard
        template={`Topic sentence: State your opinion.
"In my opinion, ..." / "I strongly believe that ..."

Supporting (2-3 reason/example):
"Firstly, ..." / "For instance, ..." / "Furthermore, ..."

Concession: Acknowledge the other side.
"Although some people argue that ..."

Conclusion: Restate opinion differently.
"For these reasons, I believe that ..."`}
        blanks={[
          "In my opinion, ___ is important/beneficial because ___.",
          "Firstly, ___ (reason 1). For instance, ___.",
          "Furthermore, ___ (reason 2). This shows that ___.",
          "Although some people argue that ___, I believe that ___.",
          "For these reasons, it is clear that ___.",
        ]}
        example={`In my opinion, learning English is essential in today's world. Firstly, English is the global language of business and science, which means that having strong skills opens up many career opportunities. Furthermore, English gives access to a vast amount of information online. Although some people argue that translation apps are sufficient, these tools are not always accurate. For these reasons, I believe that investing time in learning English is one of the most valuable things a person can do.`}
      />,
    },
    {
      id: 'essay-intro',
      title: 'IELTS Essay Girişi — Essay Introduction',
      body: <WritingCard
        template={`Hook: A surprising fact or statement.
"In recent years, ..." / "It is widely debated whether ..."

Background: Briefly explain the issue.
"[Topic] has become increasingly important because..."

Thesis: State your position.
"This essay will argue that..." / "I believe that..."`}
        blanks={[
          "In recent years, ___ has become a controversial issue.",
          "___ has both advantages and disadvantages.",
          "This essay will argue that ___ because ___.",
        ]}
        example={`In recent years, the use of social media has become a controversial topic. While it connects millions of people instantly, concerns have been raised about its impact on mental health and privacy. This essay will argue that, although social media has some clear benefits, its negative effects on young people's wellbeing outweigh the advantages, and therefore stricter regulation is necessary.`}
      />,
    },
    {
      id: 'ielts-task1',
      title: 'IELTS Task 1 Giriş — Paraphrase Tekniği',
      body: <WritingCard
        template={`Original → Paraphrase (aynı anlamı farklı kelimelerle yaz)

"The [chart/graph] shows/illustrates/presents [what] [when/where]."

Paraphrase teknikleri:
• Synonyms: shows → illustrates → provides data on
• Word order change
• Noun ↔ verb
• Active ↔ passive`}
        blanks={[
          "The bar chart shows → The bar chart illustrates / provides data on...",
          "The number of people who... → The proportion of individuals who...",
          "Between 2000 and 2020 → Over a twenty-year period",
          "In three countries → across three nations",
        ]}
        example={`Original: "The graph below shows the percentage of people using the internet in three countries between 2000 and 2020."

Paraphrase: "The line graph illustrates the proportion of individuals who used the internet across three nations over a twenty-year period from 2000 to 2020."

Değişiklikler: 'percentage'→'proportion' | 'people'→'individuals' | 'shows'→'illustrates' | 'three countries'→'three nations'`}
      />,
    },
  ],
}

export function WritingModule() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: '#ffffff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Yazma</h2>
        <p style={{ color: '#a0a0a0', fontSize: 13 }}>Şablonlarla yaz, örneklerden öğren, pratik yap.</p>
      </div>
      <LevelTabsLayout moduleKey="writing" content={CONTENT} />
    </div>
  )
}
