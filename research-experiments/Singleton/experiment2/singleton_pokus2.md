CALL {
MATCH (classNode:Class)
MATCH (classType:Type {fqn: classNode.fqn})

// Požiadavka: trieda musí mať aspoň jeden private constructor
WHERE EXISTS {
    MATCH (classType)-[:DECLARES]->(ctor)
    WHERE (ctor:Constructor OR (ctor:Method AND ctor.name = classNode.name))
      AND (ctor.isPrivate = true
           OR EXISTS { MATCH (ctor)-[:HAS_MODIFIER]->(:Modifier {name:"private"}) })
}

// 1. Statický field vlastného typu
MATCH (classType)-[:HAS_FIELD]->(instanceField:Field)-[:FIELD_TYPE]->(classType)
WHERE instanceField.isStatic = true
   OR EXISTS {
        MATCH (instanceField)-[:HAS_MODIFIER]->(:Modifier {name:"static"})
      }

// 2. Statický accessor bez parametrov
MATCH (classType)-[:DECLARES]->(accessorMethod:Method)
WHERE (accessorMethod.isStatic = true
   OR EXISTS {
        MATCH (accessorMethod)-[:HAS_MODIFIER]->(:Modifier {name:"static"})
      })
  AND NOT EXISTS {
        MATCH (accessorMethod)-[:HAS_PARAMETER]->()
      }

// 3. Accessor vracia rovnaký typ
WITH classNode, classType, instanceField, accessorMethod
WHERE EXISTS { MATCH (accessorMethod)-[:RETURN_TYPE]->(classType) }
   OR accessorMethod.returnType = classNode.name
   OR accessorMethod.returnType STARTS WITH (classNode.name + "<")

SET classType:Singleton
}
