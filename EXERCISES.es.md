# Mis soluciones

Cómo resolví cada nivel y **por qué funciona**. 🇬🇧 [In English](EXERCISES.md)

---

### 1. Commits: puntos de guardado
```
git commit -m "Agregar página de inicio"
git commit -m "Agregar formulario de contacto"
```
Cada commit es una foto que apunta a la anterior. `main` avanza al commit más nuevo cada vez, porque HEAD está pegado a `main`.

### 2. Ramas: mundos paralelos
```
git switch -c new-feature
git commit
```
`switch -c` crea la rama **y** mueve HEAD a ella. Por eso el siguiente commit mueve `new-feature` y `main` se queda donde estaba.

### 3. Merge: juntar el trabajo
```
git merge bugfix
```
Ya estoy en `main` (la rama que recibe el trabajo). Las dos ramas tienen commits que la otra no tiene, así que Git no puede solo adelantar `main`. Crea un commit de merge con dos padres.

### 4. Rebase: historia en línea recta
```
git switch feature
git rebase main
```
Rebase copia mis commits (C2, C3 → C2', C3') encima del último `main`. Los originales se apagan porque ya ninguna rama los apunta. Solo hago rebase de mi propia rama, nunca de commits que otras personas ya tienen.

### 5. HEAD: dónde estás parado
```
git checkout C1
```
Hacer checkout de un commit (no de una rama) deja HEAD separado. Sirve para mirar el pasado. Si quisiera guardar trabajo nuevo desde ahí, primero crearía una rama.

### 6. Referencias relativas: ~ y ^
```
git branch review main~2
git checkout main^
```
`main~2` = dos pasos atrás de `main` (C2). `main^` = el padre de `main` (C3). Más rápido y seguro que copiar ids.

### 7. Deshacer: reset vs revert
```
git switch local
git reset HEAD~1
git switch shared
git revert HEAD
```
`local` es privada, así que puedo reescribirla: `reset` mueve la rama un commit atrás. `shared` ya se subió, así que no la reescribo: `revert` agrega un commit nuevo que cancela al malo.

### 8. Cherry-pick: escoger commits
```
git cherry-pick C2 C4
```
Solo quiero los dos arreglos, no la prueba rara (C3). Un merge traería los tres; cherry-pick copia solo los que nombro.

### 9. Tags: marcar versiones
```
git tag v1.0 C1
git tag v2.0
```
Los tags nunca se mueven, a diferencia de las ramas. Sin destino, el tag va donde está HEAD.

### 10. Desafío final: un flujo real
```
git switch -c feature/login
git commit -m "Formulario de login"
git commit -m "Validación de login"
git switch main
git merge --no-ff feature/login
git tag v1.0
```
`main` no se movió, así que un merge normal solo haría fast-forward. `--no-ff` obliga a crear un commit de merge, y la historia muestra la función como una unidad. Después marco la versión. **Así mismo se construyó este repositorio**: una rama y un pull request por función, merge a `main` y tag `v1.0.0`.
