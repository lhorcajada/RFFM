import type { CSSProperties } from 'react';
import type { Player, Demarcation, Status } from '../types';

// Normalise: trim, uppercase, strip diacritics, collapse spaces
export const normCat = (s: string) =>
  s
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

// [background, color] per exact normalised league name
export const CAT_COLORS: Record<string, [string, string]> = {
  'SUPERLIGA INFANTIL': ['rgba(0,200,83,0.24)', '#00c853'],
  'DIVISION DE HONOR INFANTIL': ['rgba(0,230,118,0.22)', '#00e676'],
  'PRIMERA DIVISION AUTONOMICA INFANTIL': ['rgba(105,240,174,0.18)', '#69f0ae'],
  'PREFERENTE INFANTIL': ['rgba(102,187,106,0.18)', '#66bb6a'],
  'PRIMERA INFANTIL': ['rgba(129,199,132,0.16)', '#81c784'],
  'SEGUNDA INFANTIL': ['rgba(165,214,167,0.14)', '#a5d6a7'],
  'SUPERLIGA CADETE': ['rgba(0,131,143,0.26)', '#00838f'],
  'DIVISION DE HONOR CADETE': ['rgba(0,188,212,0.24)', '#00bcd4'],
  'PRIMERA DIVISION AUTONOMICA CADETE': ['rgba(0,229,255,0.20)', '#00e5ff'],
  'PREFERENTE CADETE': ['rgba(79,195,247,0.18)', '#4fc3f7'],
  'PRIMERA CADETE': ['rgba(129,212,250,0.16)', '#81d4fa'],
  'SEGUNDA CADETE': ['rgba(144,202,249,0.14)', '#90caf9'],
  'NACIONAL JUVENIL': ['rgba(25,118,210,0.28)', '#2196f3'],
  'FINAL CAMPEON PRIMERA DIVISION AUTONOMICA JUVENIL': ['rgba(33,150,243,0.24)', '#42a5f5'],
  'PRIMERA DIVISION AUTONOMICA JUVENIL': ['rgba(77,157,224,0.22)', '#4d9de0'],
  'PREFERENTE JUVENIL': ['rgba(100,181,246,0.20)', '#64b5f6'],
  'PRIMERA JUVENIL': ['rgba(144,202,249,0.18)', '#90caf9'],
  'SEGUNDA JUVENIL': ['rgba(187,222,251,0.14)', '#bbdefb'],
  'SUPERLIGA ALEVIN': ['rgba(255,143,0,0.26)', '#ff8f00'],
  'DIVISION DE HONOR ALEVIN': ['rgba(255,160,0,0.24)', '#ffa000'],
  'PRIMERA DIVISION AUTONOMICA ALEVIN': ['rgba(255,179,0,0.22)', '#ffb300'],
  'PREFERENTE ALEVIN': ['rgba(255,202,40,0.20)', '#ffca28'],
  'PRIMERA ALEVIN': ['rgba(255,213,79,0.18)', '#ffd54f'],
  'PRIMERA DIVISION AUTONOMICA FEMENINO': ['rgba(233,30,99,0.24)', '#e91e63'],
  'PREFERENTE FUTBOL FEMENINO': ['rgba(236,64,122,0.22)', '#ec407a'],
  'PRIMERA FUTBOL FEMENINO': ['rgba(240,98,146,0.20)', '#f06292'],
  'PRIMERA DIVISION AUTONOMICA FEMENINO JUVENIL': ['rgba(186,73,180,0.24)', '#ba49b4'],
  'PREFERENTE FEMENINO JUVENIL': ['rgba(206,147,216,0.22)', '#ce93d8'],
  'PRIMERA FEMENINO JUVENIL': ['rgba(225,190,231,0.18)', '#e1bee7'],
  'PRIMERA DIVISION AUTONOMICA FEMENINO CADETE': ['rgba(216,27,96,0.26)', '#d81b60'],
  'PREFERENTE FEMENINO CADETE': ['rgba(233,30,99,0.22)', '#e91e63'],
  'PRIMERA FEMENINO CADETE': ['rgba(240,98,146,0.18)', '#f06292'],
  'TERCERA FEDERACION RFEF': ['rgba(229,57,53,0.28)', '#e53935'],
  'PLAY OFF TERCERA FEDERACION': ['rgba(239,83,80,0.26)', '#ef5350'],
  'COPA RFEF FASE AUTONOMICA': ['rgba(239,108,0,0.24)', '#ef6c00'],
  'FINAL COPA RFEF FASE AUTONOMICA': ['rgba(245,124,0,0.22)', '#f57c00'],
  'COPA RFFM PRIMERA DIVISION AUTONOMICA AFICIONADOS': ['rgba(255,152,0,0.22)', '#ff9800'],
  'FASE FINAL COPA DE AFICIONADOS RFFM TEMP 2024/25': ['rgba(255,152,0,0.20)', '#ff9800'],
  'PREFERENTE AFICIONADO': ['rgba(255,152,0,0.22)', '#ff9800'],
  'SEGUNDA AFICIONADO': ['rgba(255,183,77,0.20)', '#ffb74d'],
  'PRIMERA DIVISION AUTONOMICA BENJAMIN': ['rgba(255,112,67,0.24)', '#ff7043'],
  'PREFERENTE BENJAMIN': ['rgba(255,138,101,0.22)', '#ff8a65'],
  'PRIMERA BENJAMIN': ['rgba(255,171,145,0.20)', '#ffab91'],
  'SEGUNDA BENJAMIN': ['rgba(255,204,188,0.18)', '#ffccbc'],
  'PRIMERA DIVISION AUTONOMICA PREBENJAMIN': ['rgba(240,98,146,0.24)', '#f06292'],
  'PREFERENTE PREBENJAMIN': ['rgba(244,143,177,0.22)', '#f48fb1'],
  'PRIMERA PREBENJAMIN': ['rgba(248,187,208,0.20)', '#f8bbd0'],
  'PRIMERA DIVISION AUTONOMICA DEBUTANTES': ['rgba(171,71,188,0.24)', '#ab47bc'],
  'PREFERENTE DEBUTANTES': ['rgba(186,104,200,0.22)', '#ba68c8'],
  'PRIMERA DEBUTANTES': ['rgba(206,147,216,0.20)', '#ce93d8'],
  'VETERANOS MASCULINO F11': ['rgba(120,144,156,0.20)', '#78909c'],
  'CAMPEONATO NACIONAL DE SELECCIONES TERRITORIALES SUB-14': ['rgba(77,157,224,0.24)', '#4d9de0'],
  'CAMPEONATO NACIONAL DE SELECCIONES TERRITORIALES SUB-16': ['rgba(100,181,246,0.22)', '#64b5f6'],
  'CAMPEONATO UNIVERSITARIO FEMENINO': ['rgba(240,98,146,0.18)', '#f06292'],
  'CAMPEONATO UNIVERSITARIO MASCULINO': ['rgba(129,199,132,0.18)', '#81c784'],
  'CAMPEONATO UNIVERSITARIO MASCULINO 2A FASE F11': ['rgba(165,214,167,0.16)', '#a5d6a7'],
};

export const getCategoryStyle = (category?: string | null): CSSProperties => {
  if (!category) return {};
  const match = CAT_COLORS[normCat(category)];
  if (match) return { background: match[0], color: match[1] };
  return {};
};

export const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'descartado', label: 'Descartado' },
  { value: 'poco', label: 'Poco interés' },
  { value: 'interesado', label: 'Interesado' },
  { value: 'solicitado', label: 'Solicitado' },
  { value: 'seleccionado', label: 'Seleccionado' },
];

export const STATUS_BADGE_LABELS: Record<Status, string> = {
  descartado: 'Descartados',
  poco: 'Poco interés',
  interesado: 'Interesados',
  solicitado: 'Solicitados',
  seleccionado: 'Seleccionados',
};

export const SAMPLE_PLAYERS: Player[] = [
  { id: 1, name: 'Juan Pérez', birthYear: 1998, teamName: 'CD Ejemplo A', category: 'Juvenil A', status: 'interesado', rating: 78, totalGoals: 12 },
  { id: 2, name: 'María López', birthYear: 2000, teamName: 'CD Ejemplo B', category: 'Cadete A', status: 'poco', rating: 62, totalGoals: 5 },
  { id: 3, name: 'Carlos García', birthYear: 1995, teamName: 'CD Ejemplo A', category: 'Juvenil A', status: 'seleccionado', rating: 90, totalGoals: 23 },
  { id: 4, name: 'Ana Torres', birthYear: 2003, teamName: 'CD Ejemplo C', category: 'Infantil A', status: 'descartado', rating: 45, totalGoals: 0 },
];
