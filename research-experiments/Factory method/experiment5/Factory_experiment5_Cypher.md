CALL {

// 1. Product: lokálny interface alebo abstraktná trieda
MATCH (product)
WHERE (product:Interface OR (product:Class AND product.isAbstract = true))
  AND EXISTS { MATCH (product)-[:IN_FILE]->() }

// 2-3. Creator Type deklaruje non-static metódu vracajúcu Product typ
MATCH (creatorType:Type)-[:DECLARES]->(fm:Method)
WHERE coalesce(fm.isStatic, false) = false
MATCH (fm)-[:RETURN_TYPE]->(productType:Type)
WHERE productType.fqn = product.fqn

// 4. ConcreteCreator metóda OVERRIDES factory method (strict)
MATCH (ccMethod:Method)-[:OVERRIDES]->(fm)

// 5. CC metóda CREATES ConcreteProduct
MATCH (ccMethod)-[:CREATES]->(cpType:Type)

// 6. ConcreteProduct konformuje s Product (tranzitívne)
WHERE EXISTS {
  MATCH (cpNode)-[:IMPLEMENTS|EXTENDS*1..4]->(ancestorNode)
  WHERE cpNode.fqn = cpType.fqn
    AND ancestorNode.fqn = product.fqn
    AND (cpNode:Class OR cpNode:Interface)
}

// 7. NOVÉ: ≥2 distinct ConcreteCreator tried
WITH creatorType, fm, count(DISTINCT ccMethod.containerFqn) AS distinctCCs
WHERE distinctCCs >= 2

WITH DISTINCT creatorType
SET creatorType:FactoryMethod

}
