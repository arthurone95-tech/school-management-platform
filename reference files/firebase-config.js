// ============================================
// FIREBASE CONFIGURATION - TINA'S LITTLE ANGELS
// ============================================

// Your web app's Firebase configuration
// REPLACE THE VALUES BELOW WITH YOUR ACTUAL CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCNqtNYdy3J7Cu-Tbe5Yqe9OTOolhIQhyU",
  authDomain: "tinas-little-angels.firebaseapp.com",
  projectId: "tinas-little-angels",
  storageBucket: "tinas-little-angels.firebasestorage.app",
  messagingSenderId: "523221662230",
  appId: "1:523221662230:web:9398bde58872d3e39a1337"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = firebase.auth();

// Initialize Cloud Firestore
const db = firebase.firestore();

// Optional: Enable offline persistence for better offline support
// Using the new recommended method (FirestoreSettings.cache)
// For now, we skip persistence to avoid warnings; we'll add IndexedDB separately for drafts.
// db.enablePersistence() is deprecated, so we remove it.

// ============================================
// SUBJECT MAPPING FUNCTIONS (for all classes)
// ============================================

// Get subjects based on class level
function getSubjectsForClass(studentClass) {
    const subjects = {
        creche: [
            "PRACTICAL",
            "Fine Motor Skills", "Care of Others", "Care of Environment", 
            "Grace Courtesy and Component",
            "HEALTH",
            "Wears Clean Clothes", "Good Control of Bladder", 
            "Attends Toilet at Acceptable Places and Times",
            "Eats Tidily and Independently", "Washes and Cleans Hands",
            "EMOTION AND SOCIAL DEVELOPMENT",
            "Remains Cheerful", "Mixes With Others and Show Co-Operation",
            "Shows Confidence During Different Situations", "Shows Aggression",
            "Takes Responsibility and Indicates Self-Discipline",
            "COGNITIVE AND LANGUAGE DEVELOPMENT",
            "Concentration-Follows Activity to Conclusion",
            "Can Recite Rhymes and Recall Stories", "Tell Name, Sex, Age and Common Objects",
            "Solves Simple Puzzles", "Can compare Lengths and Heights",
            "Can Identify and Pair Objects That Are The Same",
            "Scribbles and Write the Numerals from .............To ............",
            "Scribble / Write Letters of The Alphabets", "Describe Pictures",
            "Can Count from ...........To.....", 
            "Sorts and Group Objects According to Colour, Size, Texture, Shapes, Kinds, Etc.",
            "MUSIC, ART AND CREATIVITY",
            "Enjoys Music, Dancing Dramatization, Modeling and Moulding",
            "Can Draw Man With Three Parts and Enjoys Colouring",
            "ENVIRONMENTAL STUDIES (ORAL)",
            "Can Mention Sources of Water", "Can Mention Uses of Water",
            "Can Mention Items Used for Keeping the Environment Clean",
            "Can Identify Parts of The Body", "Can State Some Functions of The Parts of The Body"
        ],
        nursery1: ["Language Arts", "Numeracy", "Creative Arts", "Physical Development", "Environmental Studies", "Social Skills", "Music & Movement"],
        nursery2: ["Language Arts", "Numeracy", "Creative Arts", "Physical Development", "Environmental Studies", "Social Skills", "Music & Movement"],
        kg1: ["English Language", "Mathematics", "Science", "Creative Arts", "Our World Our People", "Physical Education", "Ghanaian Language"],
        kg2: ["English Language", "Mathematics", "Science", "Creative Arts", "Our World Our People", "Physical Education", "Ghanaian Language", "Religious & Moral Education"],
        basic1: ["ENGLISH LANGUAGE", "MATHEMATICS", "UCMAS", "INTEGRATED SCIENCE", "OUR WORLD OUR PEOPLE", "HISTORY", "CREATIVE ARTS", "RELIGIOUS & MORAL EDU.", "COMPUTING", "GHANAIAN LANGUAGE", "FRENCH", "PHYSICAL EDUCATION (P.E)"],
        basic2: ["ENGLISH LANGUAGE", "MATHEMATICS", "UCMAS", "INTEGRATED SCIENCE", "OUR WORLD OUR PEOPLE", "HISTORY", "CREATIVE ARTS", "RELIGIOUS & MORAL EDU.", "COMPUTING", "GHANAIAN LANGUAGE", "FRENCH", "PHYSICAL EDUCATION (P.E)"],
        basic3: ["ENGLISH LANGUAGE", "MATHEMATICS", "UCMAS", "INTEGRATED SCIENCE", "OUR WORLD OUR PEOPLE", "HISTORY", "CREATIVE ARTS", "RELIGIOUS & MORAL EDU.", "COMPUTING", "GHANAIAN LANGUAGE", "FRENCH", "PHYSICAL EDUCATION (P.E)"],
        basic4: ["ENGLISH LANGUAGE", "MATHEMATICS", "UCMAS", "INTEGRATED SCIENCE", "OUR WORLD OUR PEOPLE", "HISTORY", "CREATIVE ARTS", "RELIGIOUS & MORAL EDU.", "COMPUTING", "GHANAIAN LANGUAGE", "FRENCH", "PHYSICAL EDUCATION (P.E)"],
        basic5: ["ENGLISH LANGUAGE", "MATHEMATICS", "UCMAS", "INTEGRATED SCIENCE", "OUR WORLD OUR PEOPLE", "HISTORY", "CREATIVE ARTS", "RELIGIOUS & MORAL EDU.", "COMPUTING", "GHANAIAN LANGUAGE", "FRENCH", "PHYSICAL EDUCATION (P.E)"],
        basic6: ["ENGLISH LANGUAGE", "MATHEMATICS", "UCMAS", "INTEGRATED SCIENCE", "OUR WORLD OUR PEOPLE", "HISTORY", "CREATIVE ARTS", "RELIGIOUS & MORAL EDU.", "COMPUTING", "GHANAIAN LANGUAGE", "FRENCH", "PHYSICAL EDUCATION (P.E)"],
        jhs1: ["ENGLISH LANGUAGE", "MATHEMATICS", "UCMAS", "INTEGRATED SCIENCE", "CAREER TECHNOLOGY", "SOCIAL STUDIES", "CREATIVE ARTS", "RELIGIOUS & MORAL EDU.", "COMPUTING", "GHANAIAN LANGUAGE", "FRENCH", "PHYSICAL EDUCATION (P.E)"],
        jhs2: ["ENGLISH LANGUAGE", "MATHEMATICS", "UCMAS", "INTEGRATED SCIENCE", "CAREER TECHNOLOGY", "SOCIAL STUDIES", "CREATIVE ARTS", "RELIGIOUS & MORAL EDU.", "COMPUTING", "GHANAIAN LANGUAGE", "FRENCH", "PHYSICAL EDUCATION (P.E)"],
        jhs3: ["ENGLISH LANGUAGE", "MATHEMATICS", "UCMAS", "INTEGRATED SCIENCE", "CAREER TECHNOLOGY", "SOCIAL STUDIES", "CREATIVE ARTS", "RELIGIOUS & MORAL EDU.", "COMPUTING", "GHANAIAN LANGUAGE", "FRENCH", "PHYSICAL EDUCATION (P.E)"]
    };
    return subjects[studentClass] || subjects.basic1;
}

// Check if a subject is a heading (for creche)
function isHeading(item) {
    const headings = ["PRACTICAL", "HEALTH", "EMOTION AND SOCIAL DEVELOPMENT", "COGNITIVE AND LANGUAGE DEVELOPMENT", "MUSIC, ART AND CREATIVITY", "ENVIRONMENTAL STUDIES (ORAL)"];
    return headings.includes(item);
}

// Map display names to database names (for creche)
function displayNameToDbName(displayName) {
    const mapping = {
        "Scribbles and Write the Numerals from .............To ............": "Scribbles and Write the Numerals",
        "Can Count from ...........To.....": "Can Count",
        "Sorts and Group Objects According to Colour, Size, Texture, Shapes, Kinds, Etc.": "Sorts and Group Objects"
    };
    return mapping[displayName] || displayName;
}

function dbNameToDisplayName(dbName) {
    const mapping = {
        "Scribbles and Write the Numerals": "Scribbles and Write the Numerals from .............To ............",
        "Can Count": "Can Count from ...........To.....",
        "Sorts and Group Objects": "Sorts and Group Objects According to Colour, Size, Texture, Shapes, Kinds, Etc."
    };
    return mapping[dbName] || dbName;
}

// Export functions globally
window.getSubjectsForClass = getSubjectsForClass;
window.isHeading = isHeading;
window.displayNameToDbName = displayNameToDbName;
window.dbNameToDisplayName = dbNameToDisplayName;