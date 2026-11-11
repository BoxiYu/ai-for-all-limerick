// The eight lit windows of "AI for All": one ordinary evening in Limerick, one window per part of life.
// Shared by the window houses (landmarks/windows.js, built before the city fill) and the talk (explore.js).
//
// Each place is a house on a quay with one large lit ground-floor window that shows the place's still picture.
// The still is also the first frame of its Google Flow video, so the window can grow into the video without a seam.
// bank 'e' = east quay (window faces the river, -x), 'w' = west quay (faces +x). z runs north (-) to south (+).
// The library is the exception: its window is the tall arched reading-room window of the library landmark.
//
// Fact base for every line: limerick/FACTS5.json (checked 11 Nov 2026). No numbers on screen.

export const QUAY = 39;            // the quay rows' front line, |x|
export const WIN = { w: 7.2, h: 4.05, y: 3.5 };   // a 16:9 window, the same shape as the video

export const PLACES = [
  {
    id: 'kitchen', bank: 'e', z: -98, kind: 'render', label: 'Kitchen',
    kicker: 'Six o\'clock · the kitchen',
    line: 'Show it what\'s in the fridge. It suggests what to cook.',
    src: 'Illustrative scene · any AI assistant that takes photos',
    notes: 'Start small and ordinary. Two leeks, some eggs, a bit of cheese: what can I make? Take a photo and ask. It suggests a few ideas, and you choose. You know your own kitchen; it just helps you think.',
  },
  {
    id: 'nature', bank: 'w', z: -128, kind: 'render', label: 'The robin',
    kicker: 'Seven o\'clock · at the window',
    line: 'Open the window, hold up your phone. It names the bird that\'s singing.',
    src: 'Illustrative scene · Merlin Bird ID (free)',
    notes: 'Robins keep singing right through the Irish winter, and near street lights they often sing at night. A free app from the bird experts at Cornell listens through the microphone and suggests which bird it is. Point the camera at a flower and another free app suggests its name. It is not always right, but it turns a walk into a little discovery.',
  },
  {
    id: 'library', bank: 'e', z: 34, label: 'City Library', library: true,
    kicker: 'Half seven · the library',
    line: 'Ask it anything. Learn at your own pace.',
    src: 'Illustrative scene · any AI assistant',
    notes: 'This is the window I like most. You can ask the same question five times and it never sighs. Ask it to explain it more simply, or with an example. It sounds very sure of itself, and it is not always right, so for things that matter, check. Free help to get started: AIReady.ie, and the Age-Friendly AI programme coming to libraries. Ask at your library.',
  },
  {
    id: 'travel', bank: 'w', z: -24, kind: 'georgian', label: 'Planning a trip',
    kicker: 'Eight o\'clock · planning a trip',
    line: 'Point your phone at a menu, and read it in English.',
    src: 'Illustrative scene · Google Translate or Apple Translate camera',
    notes: 'Planning a holiday: it can suggest a plan for the days. And when you are there, point the camera at a menu or a sign and the words appear in English. Download the language before you go and it works without the internet.',
  },
  {
    id: 'photos', bank: 'w', z: 66, kind: 'render', label: 'Old photos',
    kicker: 'Half eight · by the fire',
    line: 'Type "dog on the beach". The old photos come back.',
    src: 'Illustrative scene · Google Photos or Apple Photos search',
    notes: 'Thousands of photos on the phone and you can never find the one you want. Type what is in it, a dog, the beach, a birthday cake, and it finds them. Years of memories, a few letters away.',
  },
  {
    id: 'card', bank: 'e', z: 152, kind: 'georgian', label: 'A Christmas card',
    kicker: 'Nine o\'clock · a card arrives',
    line: 'It reads the card aloud, so she can enjoy it herself.',
    src: 'Illustrative scene · Be My AI in the free Be My Eyes app',
    notes: 'For someone whose eyes are not what they were, a small thing: a Christmas card. Take a photo of it with a free app and it reads out the words and describes the picture. She does not have to wait for someone to come and read it to her.',
  },
  {
    id: 'verse', bank: 'w', z: 150, kind: 'georgian', label: 'A few lines',
    kicker: 'Half nine · a few lines for far away',
    line: 'It helps with the words. The best line is yours.',
    src: 'Illustrative scene · any AI assistant',
    notes: 'A daughter in Australia, a card to write, and the words will not come. Ask it for a few ideas for a short verse. Then change it, make it sound like you, and add the line only you could write.',
  },
  {
    id: 'weather', bank: 'e', z: 214, kind: 'georgian', label: 'Tomorrow\'s weather',
    kicker: 'Ten o\'clock · the forecast',
    line: 'Behind the forecast, scientists now run an AI forecast too.',
    src: 'Illustrative scene · ECMWF, Europe\'s weather centre, runs an AI forecast alongside its usual one',
    notes: 'Some of AI\'s help you never see. Europe\'s main weather centre, whose forecasts our forecasters rely on, now runs an AI forecast alongside its traditional one, and people are still in charge. Met Éireann is also doing AI research with UCD to improve forecasts here. On the sofa it is simple: tomorrow looks bright, so the wellies come out.',
  },
];

/** Window geometry and camera for a quay place (the library defines its own in explore.js). */
export function quayWindow(p) {
  const s = p.bank === 'e' ? 1 : -1, x = s * (QUAY - 0.16);
  return {
    c: { x, y: WIN.y, z: p.z }, w: WIN.w, h: WIN.h, face: -s,           // face: the window's normal along x
    near: { pos: { x: x - s * 15.5, y: WIN.y + 0.9, z: p.z }, at: { x, y: WIN.y, z: p.z } },
    spot: { x: s * (QUAY + 2), y: 19.5, z: p.z },
  };
}
