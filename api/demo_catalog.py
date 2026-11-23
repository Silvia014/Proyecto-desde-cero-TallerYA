"""Fictional Bogotá workshops and their bilingual take-home projects."""

EDITIONS = [
    ("Creación de alfombras", "Rug making", 12, 10, 210, 165000, "Estudio Trama · Chapinero",
     "Una alfombra pequeña con tu propio diseño, hecha con una pistola de tufting.",
     "A small tufted rug in your own design."),
    ("Desarrollo humano", "Personal development", 13, 9, 120, 75000, "Sala Horizonte · Teusaquillo",
     "Un mapa de fortalezas y un plan personal de hábitos para los próximos 30 días.",
     "A strengths map and a personal 30-day habit plan."),
    ("Modelado en arcilla", "Clay hand-building", 15, 14, 150, 95000, "Casa Arcilla · Chapinero",
     "Un cuenco modelado a mano y decorado con texturas.",
     "A hand-built bowl decorated with your own textures."),
    ("Zapatos artesanales", "Handcrafted shoes", 18, 10, 240, 195000, "Taller Suela · La Candelaria",
     "Un par de alpargatas de lona, cortadas y cosidas a mano.",
     "A pair of canvas espadrilles, cut and sewn by hand."),
    ("Tazas hechas a mano", "Handmade cups", 20, 15, 180, 115000, "Patio Barro · Usaquén",
     "Una taza de arcilla con asa y decoración propia, lista para cocción posterior.",
     "A clay mug with a handle and your own decoration, ready for firing later."),
    ("Estampación botánica", "Botanical printing", 22, 11, 150, 85000, "Estudio Hoja · Quinta Camacho",
     "Una bolsa de tela estampada con formas de hojas y flores.",
     "A tote bag printed with leaf and flower shapes."),
]
PROJECTS = {edition[0]: {"es": edition[-2], "en": edition[-1]} for edition in EDITIONS}
PROJECTS.update({
    "Cerámica a mano": {"es": "Una bandeja de cerámica con texturas.", "en": "A textured ceramic tray."},
    "Fotografía urbana": {"es": "Una serie breve de fotos de calle.", "en": "A short street photography series."},
    "Encuadernación artesanal": {"es": "Un cuaderno cosido a mano.", "en": "A hand-stitched notebook."},
    "Cocina colombiana": {"es": "Un menú colombiano para compartir.", "en": "A Colombian menu to share."},
})
