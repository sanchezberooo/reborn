'use client'

import { LevelTabsLayout, ReadingCard, type LevelContent } from './level-tabs'

const CONTENT: LevelContent = {
  A1: [
    {
      id: 'my-name',
      title: 'My Name is Ali',
      body: <ReadingCard
        text="My name is Ali. I am 22 years old. I am from Turkey. I live in Istanbul. I am a student. I study English at university. I have one sister. Her name is Zeynep. She is 18 years old. My mother is a teacher and my father is a doctor. I like football and music. My favourite colour is blue."
        questions={[
          "How old is Ali?",
          "Where does Ali live?",
          "What does Ali study?",
          "What are Ali's hobbies?",
        ]}
      />,
    },
    {
      id: 'my-house',
      title: 'My House',
      body: <ReadingCard
        text="I live in a small flat in Ankara. My flat has three rooms: a kitchen, a bedroom and a living room. There is a big sofa in the living room. I watch TV there every evening. My bedroom is small but comfortable. There is a desk and a bookshelf in my bedroom. I read books every night before I sleep. My favourite room is the kitchen because I love cooking."
        questions={[
          "How many rooms does the flat have?",
          "What is in the living room?",
          "What does the writer do every night?",
          "Why is the kitchen the writer's favourite room?",
        ]}
      />,
    },
    {
      id: 'a-school-day',
      title: 'A School Day',
      body: <ReadingCard
        text="Sara wakes up at seven o'clock every morning. She has breakfast with her family. She eats bread, cheese and drinks tea. Then she goes to school by bus. Her school starts at eight thirty. She has five lessons every day. At lunchtime, she eats in the school canteen with her friends. After school, she does her homework. In the evening, she watches TV or reads a book. She goes to bed at ten o'clock."
        questions={[
          "What time does Sara wake up?",
          "How does Sara go to school?",
          "What does Sara eat for breakfast?",
          "What does Sara do after school?",
        ]}
      />,
    },
    {
      id: 'my-pet',
      title: 'My Pet',
      body: <ReadingCard
        text="I have a cat. Her name is Luna. She is three years old. Luna is black and white. She is small but very playful. She likes sleeping in my bed. Every morning she wakes me up because she wants food. She eats fish and special cat food. Luna doesn't like dogs. She is afraid of loud noises. I love Luna very much. She is my best friend."
        questions={[
          "What is the name of the cat?",
          "What colour is the cat?",
          "Why does the cat wake the writer up every morning?",
          "What is the cat afraid of?",
        ]}
      />,
    },
    {
      id: 'food-I-like',
      title: 'Food I Like',
      body: <ReadingCard
        text="My name is Mert. I love food! My favourite food is pizza. I eat pizza every Saturday with my family. I also like soup. My mother makes very good lentil soup. I don't like vegetables. I know they are good for me, but I don't like the taste. My favourite drink is orange juice. In the morning, I always have a glass of orange juice. At school, I eat a sandwich at lunchtime. In the evening, we eat dinner together as a family. I think family dinners are very important."
        questions={[
          "What is Mert's favourite food?",
          "When does Mert eat pizza?",
          "What doesn't Mert like?",
          "What does Mert have at lunchtime?",
          "What does Mert think about family dinners?",
        ]}
      />,
    },
    {
      id: 'the-market',
      title: 'At the Market',
      body: <ReadingCard
        text="Every Sunday, my family goes to the market. We buy fresh fruit and vegetables there. The market is near our house. There are many stalls at the market. We always buy tomatoes, onions and potatoes. My mother likes talking to the sellers. She always asks about the prices. The vegetables at the market are cheaper than at the supermarket. My favourite part is the fruit stall. I love strawberries and apples. After the market, we go home and have lunch together."
        questions={[
          "When does the family go to the market?",
          "Where is the market?",
          "What vegetables do they always buy?",
          "Why is the market better than the supermarket?",
          "What is the writer's favourite part of the market?",
        ]}
      />,
    },
  ],
  A2: [
    {
      id: 'a-holiday',
      title: 'A Holiday in Cappadocia',
      body: <ReadingCard
        text="Last summer, my family and I went on a holiday to Cappadocia. It was an amazing experience. Cappadocia is a region in central Turkey, known for its unusual rock formations called 'fairy chimneys'. We stayed there for five days. On the first day, we took a hot air balloon ride at sunrise. Looking down from the sky, everything looked magical. We visited underground cities and old cave churches. The local food was delicious — we especially enjoyed the pottery kebab. On our last evening, we watched the sunset over the valley. It was the most beautiful view I have ever seen. I would love to visit Cappadocia again."
        questions={[
          "Where did the family go on holiday?",
          "How long did they stay?",
          "What did they do on the first day?",
          "What food did they enjoy?",
          "Would the writer go back to Cappadocia? How do you know?",
        ]}
      />,
    },
    {
      id: 'social-media',
      title: 'Social Media: Good or Bad?',
      body: <ReadingCard
        text="Social media has changed the way we communicate. Today, millions of people use platforms like Instagram, Twitter, and TikTok every day. There are many advantages to social media. It helps people stay connected with friends and family. It allows people to share information and news quickly. Businesses can also use social media to reach their customers. However, there are some disadvantages too. Some people spend too much time on social media instead of doing other things. It can also cause people to compare themselves to others and feel unhappy. Additionally, there is a lot of false information on social media. Overall, social media is a powerful tool, but it is important to use it wisely."
        questions={[
          "Name two advantages of social media mentioned in the text.",
          "What are two disadvantages of social media?",
          "How can businesses use social media?",
          "What does the writer think about social media overall?",
          "Do you agree with the writer's opinion? Why / Why not?",
        ]}
      />,
    },
    {
      id: 'city-vs-countryside',
      title: 'City Life vs. Country Life',
      body: <ReadingCard
        text="Many people dream of living in the countryside, but most people actually live in cities. City life has many benefits. There are more job opportunities, better hospitals, and more entertainment options. Public transport is usually more convenient in cities too. On the other hand, the countryside offers a quieter, more peaceful life. The air is cleaner and there is more green space. People in rural areas often know their neighbours and have a stronger sense of community. However, there are fewer job opportunities in the countryside, and people may need to travel far for services. Both lifestyles have their pros and cons, and the best choice depends on what you value most."
        questions={[
          "What are two advantages of city life?",
          "What are two advantages of country life?",
          "What is one disadvantage of living in the countryside?",
          "What does 'sense of community' mean in this context?",
          "Which type of life would you prefer? Give reasons.",
        ]}
      />,
    },
    {
      id: 'a-job-application',
      title: 'Getting a Job',
      body: <ReadingCard
        text="Finding a job can be a challenging process. First, you need to write a good CV (curriculum vitae). A CV is a document that lists your education, work experience, and skills. It is important to make your CV clear and well-organised. After sending your CV, you might be invited to an interview. At the interview, you will answer questions about yourself and your experience. It is important to prepare for the interview by researching the company. You should dress professionally and arrive on time. During the interview, try to be confident and speak clearly. After the interview, it is polite to send a thank-you email to the interviewer. The whole process requires patience, but with the right preparation, you can succeed."
        questions={[
          "What is a CV?",
          "What should you do to prepare for an interview?",
          "What should you do after the interview?",
          "Why is patience important in the job-search process?",
          "What does 'professionally' mean when used about dressing?",
        ]}
      />,
    },
    {
      id: 'healthy-eating',
      title: 'Healthy Eating Habits',
      body: <ReadingCard
        text="We all know that eating well is important for our health, but many people find it difficult to maintain a healthy diet. A balanced diet includes plenty of fruits and vegetables, whole grains, lean proteins, and healthy fats. Nutritionists recommend eating at least five portions of fruit and vegetables every day. It is also important to limit the amount of sugar, salt, and processed food in our diet. Drinking enough water is essential too — most adults should drink around 2 litres a day. Regular mealtimes help the body maintain its rhythm. Skipping meals, especially breakfast, can lead to overeating later in the day. The key is to make small, sustainable changes rather than trying to change everything at once."
        questions={[
          "What does a balanced diet include?",
          "How much fruit and vegetables should we eat per day?",
          "Why is skipping breakfast a bad idea?",
          "What does 'sustainable' mean in this context?",
          "What advice does the text give about changing your diet?",
        ]}
      />,
    },
    {
      id: 'a-letter-from-london',
      title: 'A Letter from London',
      body: <ReadingCard
        text={"Dear Beren,\n\nI hope you are well! I am writing to tell you about my first week in London. As you know, I started my English language course on Monday. The school is in the centre of London, not far from the British Museum. There are students from 15 different countries in my class, which is really exciting. My teacher, Mr. Thompson, is very patient and funny.\n\nThe city is incredible. Everything is so busy and multicultural. I visited Tower Bridge yesterday and took so many photos! The public transport here is very efficient — I use the Tube every day. The only problem is that it is quite expensive to live here. A cup of coffee costs almost four pounds!\n\nI miss home, but I am really enjoying the experience. I will send you a postcard soon.\n\nLove, Ayla"}
        questions={[
          "Why is Ayla in London?",
          "What does Ayla say about her teacher?",
          "What did Ayla visit yesterday?",
          "What problem does Ayla mention?",
          "How does Ayla feel about being in London?",
        ]}
      />,
    },
  ],
  B1: [
    {
      id: 'climate-change',
      title: 'Climate Change: A Global Challenge',
      body: <ReadingCard
        text={"Climate change is one of the most pressing issues of our time. Scientific evidence shows that the Earth's temperature has been rising due to increased levels of greenhouse gases, particularly carbon dioxide, in the atmosphere. These gases trap heat from the sun and prevent it from escaping into space — a process known as the greenhouse effect. Human activities such as burning fossil fuels, deforestation, and industrial farming are the main contributors to this problem.\n\nThe consequences of climate change are already visible around the world. Rising sea levels threaten coastal communities. More frequent and intense storms, droughts, and wildfires are becoming the norm in many regions. Biodiversity is declining as ecosystems struggle to adapt to rapid environmental changes.\n\nAddressing climate change requires global cooperation. The Paris Agreement of 2015 brought together almost 200 countries to commit to limiting global temperature rises to below 2°C. However, many scientists argue that current commitments are insufficient. Individuals can also contribute by reducing energy consumption, choosing sustainable transport, and supporting businesses with green practices.\n\nThe challenge of climate change is immense, but it is not insurmountable. With political will, technological innovation, and individual action, a sustainable future remains achievable."}
        questions={[
          "What is the greenhouse effect, as described in the text?",
          "Name three human activities that contribute to climate change.",
          "What are three consequences of climate change mentioned?",
          "What was the Paris Agreement?",
          "Why might individual actions be insufficient on their own?",
          "What does the writer suggest gives hope for the future?",
          "Find a word in the text that means 'not possible to overcome'.",
        ]}
      />,
    },
    {
      id: 'digital-world',
      title: 'The Digital World and Mental Health',
      body: <ReadingCard
        text={"The rapid growth of digital technology has transformed virtually every aspect of modern life. While the benefits are undeniable — greater access to information, improved communication, and unprecedented opportunities for learning — concerns are mounting about the impact of excessive screen time on mental health.\n\nResearch has consistently linked heavy social media use with increased rates of anxiety, depression, and low self-esteem, particularly among adolescents. The curated nature of social media means that users are constantly exposed to idealised images of other people's lives, which can foster unhealthy comparison and dissatisfaction. Furthermore, the algorithms that govern social media platforms are designed to maximise engagement, which often means promoting emotionally charged or controversial content.\n\nHowever, it would be an oversimplification to conclude that digital technology is inherently harmful. Technology also enables people to connect with supportive communities, access mental health resources, and maintain long-distance relationships. The key lies in how we use it. Digital literacy — the ability to use technology thoughtfully and critically — is becoming an essential skill.\n\nExperts advocate for a balanced approach: setting boundaries around screen time, taking regular breaks, and cultivating offline hobbies and relationships."}
        questions={[
          "What benefits of digital technology does the text mention?",
          "Why is heavy social media use particularly concerning for adolescents?",
          "What does 'curated' mean in the context of social media?",
          "Why are social media algorithms potentially harmful?",
          "What is 'digital literacy'?",
          "What practical advice does the text give for managing technology?",
          "Does the writer take a completely negative view of digital technology? Explain.",
        ]}
      />,
    },
    {
      id: 'artificial-intelligence',
      title: 'Artificial Intelligence: Opportunity or Threat?',
      body: <ReadingCard
        text={"Artificial intelligence (AI) is no longer science fiction. From virtual assistants on smartphones to complex algorithms that diagnose diseases, AI has become embedded in our daily lives. Proponents argue that AI has the potential to revolutionise healthcare, education, and industry. In medicine, AI systems are already capable of detecting cancers more accurately than human doctors. In education, personalised learning platforms adapt to each student's needs and pace.\n\nDespite these promising developments, concerns about AI are widespread. Perhaps the most frequently cited worry is the displacement of workers. As automation becomes more sophisticated, entire categories of jobs may be eliminated. A report by the McKinsey Global Institute estimated that up to 375 million workers worldwide might need to change occupational categories by 2030.\n\nEthical questions also abound. Facial recognition technology raises serious privacy concerns. AI systems trained on biased data can perpetuate or even amplify existing inequalities. The question of accountability — who is responsible when an AI system makes a mistake — remains legally unresolved.\n\nMany experts argue that the solution is not to resist AI, but to ensure that its development is guided by robust ethical frameworks and international regulation."}
        questions={[
          "Give two examples of how AI is already being used.",
          "What does 'displacement of workers' mean?",
          "What did the McKinsey Global Institute report suggest?",
          "What ethical concerns about AI are mentioned?",
          "What does 'perpetuate' mean in the context of the text?",
          "What solutions do experts propose to manage the risks of AI?",
          "Do you think AI is more of an opportunity or a threat? Use ideas from the text.",
        ]}
      />,
    },
    {
      id: 'language-learning',
      title: 'Why Learn a Second Language?',
      body: <ReadingCard
        text={"Learning a second language is one of the most valuable investments a person can make in themselves. Beyond the obvious practical advantages — being able to communicate with more people and access more opportunities — research suggests that bilingualism has profound effects on the brain.\n\nStudies using brain imaging technology have shown that bilingual individuals have denser grey matter in areas associated with language, attention, and memory. Importantly, being bilingual appears to delay the onset of dementia by an average of four to five years. This cognitive benefit is believed to result from the constant mental effort required to manage two linguistic systems simultaneously.\n\nLanguage learning also fosters cultural empathy. When learners engage deeply with another language, they inevitably encounter different ways of seeing and describing the world. This exposure promotes greater tolerance and understanding of other cultures.\n\nFor those deterred by the difficulty of language learning, modern research offers encouragement. Adults are capable of achieving high levels of proficiency, particularly in reading and listening, even without the supposed 'critical period' advantage of early childhood. Consistent, meaningful exposure — through reading, conversation, and media — remains the most effective path to fluency."}
        questions={[
          "What are two practical advantages of learning a second language?",
          "What do brain imaging studies show about bilingual individuals?",
          "How does bilingualism appear to affect dementia?",
          "How does language learning foster cultural empathy?",
          "What does the text say to encourage adult language learners?",
          "What is the 'critical period' mentioned in the text?",
          "Summarise in one sentence the main argument of the text.",
        ]}
      />,
    },
    {
      id: 'urbanisation',
      title: 'The Growth of Cities',
      body: <ReadingCard
        text={"For the first time in human history, more people now live in cities than in rural areas. This global trend, known as urbanisation, is reshaping societies, economies, and environments at an unprecedented pace. The United Nations estimates that by 2050, approximately 68% of the world's population will live in urban areas.\n\nUrbanisation is driven by several factors. Rural-to-urban migration is often motivated by the search for economic opportunity, better education, and improved healthcare. In rapidly developing countries, the pace of urbanisation has been particularly dramatic. Cities in China, India, and sub-Saharan Africa are growing faster than planners can accommodate.\n\nThe consequences of rapid urbanisation are complex and multifaceted. On the positive side, cities generate the majority of economic output and innovation. Concentration of people facilitates the sharing of ideas and the development of specialised industries. However, rapid, unplanned urban growth often leads to inadequate housing, traffic congestion, pollution, and strain on public services. Informal settlements — sometimes called slums — are home to approximately one billion people worldwide.\n\nSustainable urban planning is increasingly recognised as essential. The concept of the 'smart city' — which uses technology to improve the efficiency of urban systems — is gaining traction. The challenge facing city planners worldwide is to make urban growth work for everyone, not just the privileged few."}
        questions={[
          "What does 'urbanisation' mean?",
          "What percentage of the world's population will live in cities by 2050?",
          "Why do people migrate from rural areas to cities?",
          "Name two positive and two negative consequences of rapid urbanisation.",
          "What is an 'informal settlement'?",
          "What is a 'smart city'?",
          "What does the writer argue is 'the challenge facing city planners'?",
        ]}
      />,
    },
  ],
}

export function ReadingModule() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: '#ffffff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Okuma</h2>
        <p style={{ color: '#a0a0a0', fontSize: 13 }}>
          Her metni oku, anlama sorularını gör, Sanchez ile tartış.
        </p>
      </div>
      <LevelTabsLayout moduleKey="reading" content={CONTENT} />
    </div>
  )
}
