export async function getAIRecommendation(userPrompt, products) {
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const aiProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    category: p.category,
    price: p.price,
    ratings: p.ratings,
    stock: p.stock,
    images: p.images,
  }));

  const geminiPrompt = `
You are an AI product recommendation assistant.

Here is the product list:
${JSON.stringify(aiProducts, null, 2)}

User request:
"${userPrompt}"

Task:
- Choose only products that match the user request.
- Return only a valid JSON array.
- Do not include markdown.
- Do not include explanation.
- If no product matches, return [].

Example response:
[
  {
    "id": 1,
    "name": "Product name",
    "description": "Product description",
    "category": "Category",
    "price": 100000,
    "ratings": 4.5,
    "stock": 10,
    "images": []
  }
]
`;

  const response = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: geminiPrompt }],
        },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message);
  }

  const aiResponseText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

  if (!aiResponseText) {
    throw new Error("AI response is empty");
  }

  const cleanedText = aiResponseText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    const parsedProducts = JSON.parse(cleanedText);

    if (!Array.isArray(parsedProducts)) {
      throw new Error("AI response is not an array");
    }

    return parsedProducts;
  } catch (error) {
    console.log("AI raw response:", aiResponseText);
    throw new Error("Failed to parse AI response");
  }
}
