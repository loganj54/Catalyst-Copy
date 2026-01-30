with open(r'c:\Users\logan\Catalyst-engineering-ed\supabase\functions\find-videos-sandbox\index.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Insert the response object after line 173 (index 173 since 0-indexed)
response_lines = [
    '\n',
    '                            const response: FindVideosSandboxResponse = {\n',
    '                                success: true,\n',
    '                                source: \'cache\',\n',
    '                                video: {\n',
    '                                    video_id: fullVideo.video_id,\n',
    '                                    url: fullVideo.url,\n',
    '                                    title: fullVideo.title,\n',
    '                                    channel_name: fullVideo.channel_name || \'\',\n',
    '                                    thumbnail_url: fullVideo.thumbnail_url || \'\',\n',
    '                                    duration: fullVideo.duration || \'\',\n',
    '                                    summary: fullVideo.summary || \'\',\n',
    '                                    scores: {\n',
    '                                        beginner: fullVideo.beginner_score,\n',
    '                                        visualization: fullVideo.visualization_score,\n',
    '                                        math_explanation: fullVideo.math_explanation_score,\n',
    '                                        real_world: fullVideo.real_world_score,\n',
    '                                        quality: fullVideo.ai_quality_score\n',
    '                                    }\n',
    '                                },\n',
    '                                debug: {\n',
    '                                    embedding_query_text: queryText,\n',
    '                                    resource_info: `Video: "${fullVideo.title}" by ${fullVideo.channel_name || \'Unknown\'}. Scores - Beginner: ${fullVideo.beginner_score.toFixed(2)}, Visualization: ${fullVideo.visualization_score.toFixed(2)}, Math: ${fullVideo.math_explanation_score.toFixed(2)}, Real-world: ${fullVideo.real_world_score.toFixed(2)}`,\n',
    '                                    user_query: `Term: "${term}", Context: "${unit_topic || \'none\'}", Video Type: "${video_type}"`\n',
    '                                }\n',
    '                            };\n',
]

# Insert after line 173 (0-indexed, so after index 173)
new_lines = lines[:174] + response_lines + lines[174:]

with open(r'c:\Users\logan\Catalyst-engineering-ed\supabase\functions\find-videos-sandbox\index.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Successfully added response declaration")
