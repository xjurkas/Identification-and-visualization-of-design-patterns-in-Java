CALL {
// 1. AbstractClass: abstract Java trieda v projekte
MATCH (abstractNode:Class)
WHERE (abstractNode.isAbstract = true
       OR EXISTS { MATCH (abstractNode)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) })
  AND EXISTS { MATCH (abstractNode)-[:IN_FILE]->() }

MATCH (abstractType:Type {fqn: abstractNode.fqn})

WITH abstractNode, abstractType

// 2. Má aspoň jednu konkrétnu (non-abstract) metódu — template method kandidát
WHERE EXISTS {
    MATCH (abstractType)-[:DECLARES]->(tm:Method)
    WHERE tm.isAbstract = false
       OR (NOT EXISTS { MATCH (tm)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
           AND tm.isAbstract IS NULL)
}

// 3. Má aspoň jednu abstraktnú metódu — primitive operation kandidát
AND EXISTS {
    MATCH (abstractType)-[:DECLARES]->(po:Method)
    WHERE po.isAbstract = true
       OR EXISTS { MATCH (po)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"}) }
}

// 4. Existuje aspoň jedna podtrieda (ConcreteClass)
AND EXISTS {
    MATCH (concreteClass:Class)-[:EXTENDS*1..3]->(abstractNode)
    WHERE concreteClass.fqn <> abstractNode.fqn
}
WITH abstractNode, abstractType

MATCH (abstractType)-[:DECLARES]->(tm:Method)
WHERE tm.isAbstract = false
   OR (
        NOT EXISTS {
          MATCH (tm)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"})
        }
        AND tm.isAbstract IS NULL
      )

MATCH (abstractType)-[:DECLARES]->(po:Method)
WHERE po.isAbstract = true
   OR EXISTS {
        MATCH (po)-[:HAS_MODIFIER]->(:Modifier {name:"abstract"})
      }

MATCH (concreteClass:Class)-[:EXTENDS*1..3]->(abstractNode)
WHERE concreteClass.fqn <> abstractNode.fqn

WITH
  abstractType,
  collect(DISTINCT tm.name) AS templateMethodNames,
  collect(DISTINCT po.name) AS primitiveOperationNames,
  collect(DISTINCT concreteClass.fqn) AS concreteClassFqns

SET abstractType:AbstractClass

RETURN DISTINCT
  abstractType,
  templateMethodNames,
  primitiveOperationNames,
  concreteClassFqns
}

RETURN DISTINCT
  abstractType.fqn AS abstractClassFqn,
  templateMethodNames,
  primitiveOperationNames,
  concreteClassFqns
ORDER BY abstractClassFqn;
