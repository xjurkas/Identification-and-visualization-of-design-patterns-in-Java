CALL {
MATCH (classNode:Class)
MATCH (classType:Type {fqn: classNode.fqn})

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
WHERE (EXISTS { MATCH (accessorMethod)-[:RETURN_TYPE]->(classType) }
   OR accessorMethod.returnType = classNode.name
   OR accessorMethod.returnType STARTS WITH (classNode.name + "<"))

// 4. NOVÉ: Vyžaduj aspoň jeden reinforcing indikátor:
//    A) Private constructor ALEBO B) Singleton naming convention
  AND (
    // A: Trieda má aspoň jeden private constructor
    EXISTS {
      MATCH (classType)-[:DECLARES]->(ctor)
      WHERE (ctor:Constructor OR (ctor:Method AND ctor.name STARTS WITH classNode.name + "("))
        AND (ctor.isPrivate = true
             OR ctor.isPrivateConstructor = true
             OR EXISTS { MATCH (ctor)-[:HAS_MODIFIER]->(:Modifier {name:"private"}) })
    }
    OR
    // B: Accessor má meno typické pre Singleton
    //    (STARTS WITH namiesto = kvôli "()" v menách metód v grafe)
       toLower(accessorMethod.name) STARTS WITH "getinstance"
    OR toLower(accessorMethod.name) STARTS WITH "getdefault"
    OR toLower(accessorMethod.name) STARTS WITH "getcurrent"
    OR toLower(accessorMethod.name) STARTS WITH "getshared"
    OR toLower(accessorMethod.name) STARTS WITH ("get" + toLower(classNode.name))
    OR toLower(accessorMethod.name) STARTS WITH "instance"
    OR toLower(accessorMethod.name) STARTS WITH "singleton"
  )

SET classType:Singleton

RETURN DISTINCT classType, instanceField, accessorMethod
}

RETURN DISTINCT
  classType.fqn AS singletonFqn,
  instanceField.name AS instanceFieldName,
  accessorMethod.name AS accessorMethodName
ORDER BY singletonFqn;
