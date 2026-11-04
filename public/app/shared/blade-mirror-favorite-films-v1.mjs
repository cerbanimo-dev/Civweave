/**
 * Author-approved, non-spoiler character preferences for The Blade & Mirror Saga.
 * Reusable by the Convergence cast and the opt-in Persona Library.
 * Never implies a scene happened or that an actor has seen a private source.
 */
export const BLADE_MIRROR_FAVORITE_FILMS=Object.freeze({
  magnus:'Southland Tales',
  maggie:'Scott Pilgrim vs. the World',
  landry:'The Big Lebowski',
  delia:'Death Proof'
});
const normalize=value=>typeof value==='string'?value.trim().toLowerCase().replace(/^book:/,''):'';
/** Match character ID first; display name is a fallback for authored casts. */
export function favoriteFilmForBookCharacter(character){
  const candidates=typeof character==='string'?[character]:
    [character?.id,character?.character,character?.name,character?.displayName];
  for(const candidate of candidates){
    const film=BLADE_MIRROR_FAVORITE_FILMS[normalize(candidate)];
    if(film)return film;
  }
  return null;
}
/** Do not apply book canon to an unrelated user-created persona pack. */
export function favoriteFilmForPersona(pack,character){
  const scope=[pack?.id,pack?.series,pack?.universe].filter(v=>typeof v==='string').join('').toLowerCase().replace(/[^a-z]/g,'');
  if(!['blademirror','mirrorblade','bladeandmirror','mirrorandblade'].some(x=>scope.includes(x)))return null;
  return favoriteFilmForBookCharacter(character);
}
