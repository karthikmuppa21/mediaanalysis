from flask import Flask, jsonify, request , render_template
from flask_cors import CORS  # To handle CORS issues
import re
import spacy
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from langdetect import detect
import matplotlib.pyplot as plt
import seaborn as sns
import io
import base64

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend-backend communication

# Load spaCy model for tokenization and lemmatization
nlp = spacy.load('en_core_web_sm')
analyzer = SentimentIntensityAnalyzer()

# Preprocessing function to clean the comment
def preprocess_comment(comment):
    # Remove URLs, mentions, hashtags, and make it lowercase
    comment = re.sub(r"http\S+|www\S+|https\S+", '', comment)
    comment = re.sub(r'\@\w+|\#', '', comment)
    comment = comment.lower()
    
    # Tokenization and Lemmatization using spaCy
    doc = nlp(comment)
    words = [token.lemma_ for token in doc if not token.is_stop and not token.is_punct]
    return ' '.join(words)

# Function to get sentiment (positive, neutral, negative)
def get_sentiment(comment):
    sentiment_score = analyzer.polarity_scores(comment)
    if sentiment_score['compound'] > 0.05:
        return 'Positive'
    elif sentiment_score['compound'] < -0.05:
        return 'Negative'
    else:
        return 'Neutral'

# Query detection function (detects if the comment is a question)
def is_question(comment):
    question_words = ["what", "why", "how", "when", "where", "can", "could", "would", "should", "is", "are", "do", "does", "will", "did"]
    return any(word in comment.lower() for word in question_words) or '?' in comment

# Function to detect the language of the comment (using langdetect)
def detect_language(comment):
    try:
        return detect(comment)
    except:
        return 'unknown'

# Function to calculate comment length (number of words)
def get_comment_length(comment):
    return len(comment.split())

# Function to generate bar plot for comment lengths
def generate_comment_length_plot(comment_lengths):
    plt.figure(figsize=(10, 6))
    sns.countplot(x=comment_lengths, palette='Blues_d')
    plt.title('Distribution of Comment Lengths', fontsize=16)
    plt.xlabel('Comment Length (Words)', fontsize=12)
    plt.ylabel('Frequency', fontsize=12)
    
    # Save plot to a BytesIO object
    img = io.BytesIO()
    plt.savefig(img, format='png')
    img.seek(0)
    
    # Encode the image to base64
    img_base64 = base64.b64encode(img.getvalue()).decode('utf-8')
    
    # Close the plot
    plt.close()
    
    return img_base64


@app.route('/', methods=['GET'])
def home():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze_comments():
    # Get comments from the frontend request
    comments = request.json.get("comments")
    
    sentiments = []
    query_flags = []
    comment_lengths = []
    languages = []
    processed_comments = []
    
    # Process each comment
    for comment in comments:
        language = detect_language(comment)
        languages.append(language)
        
        # If the comment is not in English, you could translate it, but we'll skip translation for now
        if language != 'en':  
            comment = comment  # You could add translation here if needed
        
        processed_comment = preprocess_comment(comment)
        processed_comments.append(processed_comment)
        
        sentiments.append(get_sentiment(processed_comment))
        query_flags.append(is_question(comment))
        comment_lengths.append(get_comment_length(comment))
    
    # Generate the plot for comment lengths
    plot_base64 = generate_comment_length_plot(comment_lengths)
    
    # Return analysis as JSON with the plot image in base64 format
    response_data = {
        "sentiments": sentiments,
        "query_flags": query_flags,
        "comment_lengths": comment_lengths,
        "languages": languages,
        "comments": processed_comments,
        "comment_length_plot": plot_base64  # Include the plot image as base64
    }

    return jsonify(response_data)

if __name__ == '__main__':
    app.run(debug=True)
