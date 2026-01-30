$filePath = "c:\Users\logan\Catalyst-engineering-ed\supabase\functions\find-videos-sandbox\index.ts"
$content = Get-Content $filePath -Raw

# Find the line with "console.log(`  - Channel:" and insert the response object after it
$searchPattern = "console\.log\(`  - Channel: \$\{fullVideo\.channel_name \|\| 'Unknown'\}`\);\r\n\r\n                            console\.log\('\[Sandbox\] Returning cached video"

$replacement = @"
console.log(``  - Channel: `${fullVideo.channel_name || 'Unknown'}``);

                            const response: FindVideosSandboxResponse = {
                                success: true,
                                source: 'cache',
                                video: {
                                    video_id: fullVideo.video_id,
                                    url: fullVideo.url,
                                    title: fullVideo.title,
                                    channel_name: fullVideo.channel_name || '',
                                    thumbnail_url: fullVideo.thumbnail_url || '',
                                    duration: fullVideo.duration || '',
                                    summary: fullVideo.summary || '',
                                    scores: {
                                        beginner: fullVideo.beginner_score,
                                        visualization: fullVideo.visualization_score,
                                        math_explanation: fullVideo.math_explanation_score,
                                        real_world: fullVideo.real_world_score,
                                        quality: fullVideo.ai_quality_score
                                    }
                                },
                                debug: {
                                    embedding_query_text: queryText,
                                    resource_info: ``Video: "`${fullVideo.title}" by `${fullVideo.channel_name || 'Unknown'}. Scores - Beginner: `${fullVideo.beginner_score.toFixed(2)}, Visualization: `${fullVideo.visualization_score.toFixed(2)}, Math: `${fullVideo.math_explanation_score.toFixed(2)}, Real-world: `${fullVideo.real_world_score.toFixed(2)}``,
                                    user_query: ``Term: "`${term}", Context: "`${unit_topic || 'none'}", Video Type: "`${video_type}"``
                                }
                            };

                            console.log('[Sandbox] Returning cached video"@

$newContent = $content -replace $searchPattern, $replacement

Set-Content -Path $filePath -Value $newContent -NoNewline
Write-Host "Fixed response declaration"
