const { generateContent, generateEmbedding } = require('./utils/gemini');
(async () => {
    console.log('Text:', await generateContent('Nói xin chào bằng một câu'));
    const v = await generateEmbedding('áo khoác cũ');
    console.log('Embedding length:', v?.length);
})();