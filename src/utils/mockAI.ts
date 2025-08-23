// Mock AI service for waste identification
// In a real app, this would connect to an actual AI service

interface WasteItem {
  id: string;
  name: string;
  image: string;
  homeCategory: string;
  recyclingCategory: string;
  description: string;
  confidence: number;
  timestamp: Date;
}

const wasteDatabase = [
  {
    keywords: ['mælk', 'karton', 'tetrapak', 'juice', 'saft'],
    name: 'Mælkekarton',
    homeCategory: 'Mad- & drikkekartoner',
    recyclingCategory: 'Pap',
    description: 'Tetrapak karton til mælk, juice eller andre drikkevarer. Skal tømmes og skylles før sortering.'
  },
  {
    keywords: ['dåse', 'konserves', 'tomat', 'bønner', 'metal'],
    name: 'Konservesdåse',
    homeCategory: 'Metal & glas',
    recyclingCategory: 'Metal',
    description: 'Metal konservesdåse. Skal tømmes og skylles før sortering i metal containeren.'
  },
  {
    keywords: ['æble', 'frugt', 'mad', 'kompost', 'organisk'],
    name: 'Æbleskrog',
    homeCategory: 'Madaffald',
    recyclingCategory: 'Madaffald/Kompost',
    description: 'Organisk madaffald som kan komposteres eller bruges til biogas produktion.'
  },
  {
    keywords: ['glas', 'flaske', 'øl', 'vin', 'sodavand'],
    name: 'Glasflaske',
    homeCategory: 'Metal & glas',
    recyclingCategory: 'Glas',
    description: 'Glasflaske der kan genanvendes. Fjern låg og etiketter hvis muligt.'
  },
  {
    keywords: ['plastik', 'flaske', 'vand', 'sodavand', 'pet'],
    name: 'Plastikflaske',
    homeCategory: 'Plast',
    recyclingCategory: 'Plastik',
    description: 'PET plastikflaske. Tøm og skyl før sortering. Låget kan blive siddende på.'
  },
  {
    keywords: ['papir', 'avis', 'magasin', 'katalog'],
    name: 'Avis/Magasin',
    homeCategory: 'Papir',
    recyclingCategory: 'Papir',
    description: 'Trykt papir som aviser og magasiner. Skal være tør og ren.'
  },
  {
    keywords: ['banan', 'skræl', 'frugt', 'organisk'],
    name: 'Bananskræl',
    homeCategory: 'Madaffald',
    recyclingCategory: 'Madaffald/Kompost',
    description: 'Organisk madaffald som egner sig perfekt til kompostering.'
  }
];

export const identifyWaste = async (imageData: string): Promise<WasteItem> => {
  // Simulate AI processing time
  await new Promise(resolve => setTimeout(resolve, 2000));

  // In a real implementation, this would send the image to an AI service
  // For now, we'll randomly select an item from our database
  const randomItem = wasteDatabase[Math.floor(Math.random() * wasteDatabase.length)];
  
  return {
    id: Date.now().toString(),
    name: randomItem.name,
    image: imageData.base64,
    homeCategory: randomItem.homeCategory,
    recyclingCategory: randomItem.recyclingCategory,
    description: randomItem.description,
    confidence: Math.floor(Math.random() * 20) + 80, // 80-99% confidence
    timestamp: new Date()
  };
};